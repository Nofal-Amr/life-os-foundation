package app.lifeos;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ActiveCaloriesBurnedRecord;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.SleepSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.health.connect.datatypes.WeightRecord;
import android.os.Build;
import android.os.OutcomeReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Reads Samsung Health data through Health Connect, which is built into
 * Android 14 and later. Samsung Health writes to Health Connect once its
 * "Health Connect" sync is switched on in Samsung Health's settings.
 */
final class HealthReader {
    static final String[] PERMISSIONS = {
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
    };

    interface Done {
        void finish(JSONObject result);
    }

    private HealthReader() {}

    static boolean supported() {
        return Build.VERSION.SDK_INT >= 34;
    }

    static List<String> missing(Context context) {
        List<String> missing = new ArrayList<>();
        for (String permission : PERMISSIONS) {
            if (context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) missing.add(permission);
        }
        return missing;
    }

    /** "unsupported", "needs_permission" or "ready". */
    static String status(Context context) {
        if (!supported()) return "unsupported";
        return missing(context).size() == PERMISSIONS.length ? "needs_permission" : "ready";
    }

    /** Reads the last `days` days of every granted type, then calls `done` once. */
    static void read(Context context, int days, Done done) {
        JSONObject result = new JSONObject();
        if (!supported()) {
            put(result, "error", "Samsung Health needs Android 14 or later on this phone.");
            done.finish(result);
            return;
        }
        HealthConnectManager manager = context.getSystemService(HealthConnectManager.class);
        Instant end = Instant.now();
        TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder()
            .setStartTime(end.minus(Duration.ofDays(days)))
            .setEndTime(end)
            .build();
        JSONArray samples = new JSONArray();
        JSONArray errors = new JSONArray();
        List<String> missing = missing(context);

        List<Class<? extends Record>> types = new ArrayList<>();
        if (!missing.contains(PERMISSIONS[0])) types.add(StepsRecord.class);
        if (!missing.contains(PERMISSIONS[1])) types.add(SleepSessionRecord.class);
        if (!missing.contains(PERMISSIONS[2])) types.add(HeartRateRecord.class);
        if (!missing.contains(PERMISSIONS[3])) types.add(WeightRecord.class);
        if (!missing.contains(PERMISSIONS[4])) types.add(ExerciseSessionRecord.class);
        if (!missing.contains(PERMISSIONS[5])) types.add(ActiveCaloriesBurnedRecord.class);

        put(result, "missing", new JSONArray(missing));
        if (types.isEmpty()) {
            put(result, "samples", samples);
            done.finish(result);
            return;
        }

        Executor executor = Executors.newSingleThreadExecutor();
        AtomicInteger left = new AtomicInteger(types.size());
        for (Class<? extends Record> type : types) {
            readType(manager, type, range, executor, samples, errors, () -> {
                if (left.decrementAndGet() == 0) {
                    put(result, "samples", samples);
                    put(result, "errors", errors);
                    done.finish(result);
                }
            });
        }
    }

    private static <T extends Record> void readType(
        HealthConnectManager manager,
        Class<T> type,
        TimeInstantRangeFilter range,
        Executor executor,
        JSONArray samples,
        JSONArray errors,
        Runnable after
    ) {
        ReadRecordsRequestUsingFilters<T> request =
            new ReadRecordsRequestUsingFilters.Builder<>(type).setTimeRangeFilter(range).setPageSize(5000).build();
        try {
            readRecords(manager, type, request, executor, samples, errors, after);
        } catch (RuntimeException error) {
            // e.g. SecurityException thrown straight away: report it instead of never answering.
            synchronized (errors) {
                errors.put(type.getSimpleName() + ": " + error.getMessage());
            }
            after.run();
        }
    }

    private static <T extends Record> void readRecords(
        HealthConnectManager manager,
        Class<T> type,
        ReadRecordsRequestUsingFilters<T> request,
        Executor executor,
        JSONArray samples,
        JSONArray errors,
        Runnable after
    ) {
        manager.readRecords(request, executor, new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
            @Override
            public void onResult(ReadRecordsResponse<T> response) {
                synchronized (samples) {
                    for (T record : response.getRecords()) addSample(samples, record);
                }
                after.run();
            }

            @Override
            public void onError(HealthConnectException error) {
                synchronized (errors) {
                    errors.put(type.getSimpleName() + ": " + error.getMessage());
                }
                after.run();
            }
        });
    }

    private static void addSample(JSONArray samples, Record record) {
        String id = record.getMetadata().getId();
        String source = record.getMetadata().getDataOrigin().getPackageName();
        if (record instanceof StepsRecord) {
            StepsRecord r = (StepsRecord) record;
            samples.put(sample("steps", r.getCount(), "count", r.getStartTime(), r.getEndTime(), source, id));
        } else if (record instanceof SleepSessionRecord) {
            SleepSessionRecord r = (SleepSessionRecord) record;
            long minutes = Duration.between(r.getStartTime(), r.getEndTime()).toMinutes();
            samples.put(sample("sleep", minutes, "min", r.getStartTime(), r.getEndTime(), source, id));
        } else if (record instanceof HeartRateRecord) {
            HeartRateRecord r = (HeartRateRecord) record;
            if (r.getSamples().isEmpty()) return;
            double sum = 0;
            for (HeartRateRecord.HeartRateSample s : r.getSamples()) sum += s.getBeatsPerMinute();
            samples.put(sample("heart_rate", sum / r.getSamples().size(), "bpm", r.getStartTime(), r.getEndTime(), source, id));
        } else if (record instanceof WeightRecord) {
            WeightRecord r = (WeightRecord) record;
            samples.put(sample("weight", r.getWeight().getInGrams() / 1000.0, "kg", r.getTime(), null, source, id));
        } else if (record instanceof ExerciseSessionRecord) {
            ExerciseSessionRecord r = (ExerciseSessionRecord) record;
            long minutes = Duration.between(r.getStartTime(), r.getEndTime()).toMinutes();
            samples.put(sample("exercise", minutes, "min", r.getStartTime(), r.getEndTime(), source, id));
        } else if (record instanceof ActiveCaloriesBurnedRecord) {
            ActiveCaloriesBurnedRecord r = (ActiveCaloriesBurnedRecord) record;
            samples.put(sample("active_calories", r.getEnergy().getInCalories() / 1000.0, "kcal", r.getStartTime(), r.getEndTime(), source, id));
        }
    }

    private static JSONObject sample(String kind, double value, String unit, Instant start, Instant end, String source, String id) {
        JSONObject json = new JSONObject();
        put(json, "kind", kind);
        put(json, "value", value);
        put(json, "unit", unit);
        put(json, "start_at", start.toString());
        put(json, "end_at", end == null ? JSONObject.NULL : end.toString());
        put(json, "source", source);
        put(json, "external_id", id);
        return json;
    }

    private static void put(JSONObject json, String key, Object value) {
        try {
            json.put(key, value);
        } catch (Exception ignored) {
            // Keys are fixed strings; this can't fail.
        }
    }
}
