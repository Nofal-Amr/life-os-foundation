package app.lifeos;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.icu.text.SimpleDateFormat;
import android.icu.util.ULocale;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Home-screen prayer widget. The web app hands over prayer times and what's
 * logged (setWidgetData); this draws them, counts down to the next prayer
 * live, and refreshes itself at each prayer time and every 15 minutes.
 */
public class PrayerWidget extends AppWidgetProvider {
    static final String PREFS = "widget";
    static final String KEY_DATA = "prayers";
    private static final String ACTION_TICK = "app.lifeos.WIDGET_TICK";

    private static final int[] NAMES = {R.id.name0, R.id.name1, R.id.name2, R.id.name3, R.id.name4};
    private static final int[] TIMES = {R.id.time0, R.id.time1, R.id.time2, R.id.time3, R.id.time4};
    private static final int[] MARKS = {R.id.mark0, R.id.mark1, R.id.mark2, R.id.mark3, R.id.mark4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_TICK.equals(intent.getAction())) refresh(context);
        else super.onReceive(context, intent);
    }

    /** Redraws every Life OS prayer widget from the stored data. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PrayerWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = render(context);
        manager.updateAppWidget(ids, views);
    }

    private static final class Prayer {
        final String key;
        final String label;
        final long at;
        final String status;
        final String date;

        Prayer(JSONObject json, String date) {
            this.key = json.optString("key");
            this.label = json.optString("label");
            this.at = json.optLong("at");
            this.status = json.isNull("status") ? null : json.optString("status", null);
            this.date = date;
        }
    }

    private static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_prayers);
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context, "/spirit"));
        views.setTextViewText(R.id.hijri, hijriToday());

        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
        List<List<Prayer>> days = new ArrayList<>();
        String place = "Open Life OS to set up";
        try {
            JSONObject data = new JSONObject(raw == null ? "{}" : raw);
            place = data.optString("place", place);
            JSONArray list = data.optJSONArray("days");
            for (int d = 0; list != null && d < list.length(); d++) {
                JSONObject day = list.getJSONObject(d);
                JSONArray prayers = day.getJSONArray("prayers");
                List<Prayer> row = new ArrayList<>();
                for (int p = 0; p < prayers.length(); p++) row.add(new Prayer(prayers.getJSONObject(p), day.optString("date")));
                days.add(row);
            }
        } catch (Exception ignored) {
            // No data yet: an empty widget that opens the app.
        }
        views.setTextViewText(R.id.place, place);

        long now = System.currentTimeMillis();
        Prayer next = null;
        Prayer previous = null;
        List<Prayer> shownDay = null;
        for (List<Prayer> day : days) {
            for (Prayer prayer : day) {
                if (prayer.at > now && next == null) {
                    next = prayer;
                    shownDay = day;
                } else if (prayer.at <= now) {
                    previous = prayer;
                }
            }
        }

        if (next == null || shownDay == null) {
            views.setTextViewText(R.id.next_name, "Prayer times");
            views.setProgressBar(R.id.progress, 1000, 0, false);
            for (int i = 0; i < 5; i++) {
                views.setTextViewText(NAMES[i], "");
                views.setTextViewText(TIMES[i], "");
                views.setTextViewText(MARKS[i], "");
            }
            return views;
        }

        views.setTextViewText(R.id.next_name, next.label);
        views.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + (next.at - now), null, true);
        views.setChronometerCountDown(R.id.countdown, true);
        if (previous != null && next.at > previous.at) {
            int progress = (int) (1000L * (now - previous.at) / (next.at - previous.at));
            views.setProgressBar(R.id.progress, 1000, Math.max(0, Math.min(1000, progress)), false);
        } else {
            views.setProgressBar(R.id.progress, 1000, 0, false);
        }

        java.text.DateFormat clock = android.text.format.DateFormat.getTimeFormat(context);
        for (int i = 0; i < 5 && i < shownDay.size(); i++) {
            Prayer prayer = shownDay.get(i);
            boolean isNext = prayer == next;
            views.setTextViewText(NAMES[i], prayer.label);
            views.setTextViewText(TIMES[i], clock.format(new Date(prayer.at)).replace(" AM", "").replace(" PM", ""));
            views.setInt(TIMES[i], "setBackgroundResource", isNext ? R.drawable.widget_next : 0);
            views.setTextColor(TIMES[i], isNext ? Color.parseColor("#0A0C10") : Color.WHITE);
            // A dot under each prayer that's logged; a ring for one logged as missed.
            String mark = prayer.status == null ? "" : "missed".equals(prayer.status) ? "○" : "●";
            views.setTextViewText(MARKS[i], mark);
            views.setTextColor(MARKS[i], "missed".equals(prayer.status) ? Color.parseColor("#80FFFFFF") : Color.parseColor("#30D5C8"));
        }

        scheduleTick(context, Math.min(next.at + 1000, now + 15 * 60_000L));
        return views;
    }

    /** "12 Rabiʻ II 1448", from the Umm al-Qura calendar. */
    private static String hijriToday() {
        try {
            SimpleDateFormat format = new SimpleDateFormat("d MMMM y", new ULocale("en@calendar=islamic-umalqura"));
            return format.format(new Date());
        } catch (Exception e) {
            return "";
        }
    }

    private static PendingIntent openApp(Context context, String path) {
        Intent open = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open" + path))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 7101, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleTick(Context context, long at) {
        Intent tick = new Intent(context, PrayerWidget.class).setAction(ACTION_TICK);
        PendingIntent pending = PendingIntent.getBroadcast(context, 7102, tick,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        // Inexact is fine: the countdown itself runs live on the widget.
        alarms.set(AlarmManager.RTC, at, pending);
    }

    /* ------------------------- shared with the receivers ------------------------- */

    /** Marks a prayer as logged in the stored widget data, so it shows at once. */
    static void markLogged(Context context, String date, String name, String status) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject data = new JSONObject(prefs.getString(KEY_DATA, "{}"));
            JSONArray days = data.optJSONArray("days");
            for (int d = 0; days != null && d < days.length(); d++) {
                JSONObject day = days.getJSONObject(d);
                if (!date.equals(day.optString("date"))) continue;
                JSONArray prayers = day.getJSONArray("prayers");
                for (int p = 0; p < prayers.length(); p++) {
                    JSONObject prayer = prayers.getJSONObject(p);
                    if (name.equals(prayer.optString("key"))) prayer.put("status", status);
                }
            }
            prefs.edit().putString(KEY_DATA, data.toString()).apply();
        } catch (Exception ignored) {
            // Nothing stored yet.
        }
        refresh(context);
    }

    /** Whether the stored data already has this prayer logged. */
    static boolean isLogged(Context context, String date, String name) {
        try {
            JSONObject data = new JSONObject(
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "{}"));
            JSONArray days = data.optJSONArray("days");
            for (int d = 0; days != null && d < days.length(); d++) {
                JSONObject day = days.getJSONObject(d);
                if (!date.equals(day.optString("date"))) continue;
                JSONArray prayers = day.getJSONArray("prayers");
                for (int p = 0; p < prayers.length(); p++) {
                    JSONObject prayer = prayers.getJSONObject(p);
                    if (name.equals(prayer.optString("key")) && !prayer.isNull("status")) return true;
                }
            }
        } catch (Exception ignored) {
            // Unknown: treat as not logged.
        }
        return false;
    }

    static String label(String status) {
        switch (status) {
            case "jamaah": return "In jamaah";
            case "on_time": return "On time";
            case "clutch": return "Clutch";
            case "late": return "Late";
            default: return status.toLowerCase(Locale.ROOT);
        }
    }
}
