package app.lifeos;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Schedules the reminders the web app hands over (see src/lib/native.ts).
 * The list is stored so it can be restored after the phone restarts.
 */
final class Reminders {
    static final String CHANNEL_ID = "prayers";
    static final String TASKS_CHANNEL_ID = "tasks";
    private static final String PREFS = "reminders";
    private static final String KEY_LIST = "list";

    private Reminders() {}

    /** Replaces all scheduled reminders with the given JSON list. */
    static void replaceAll(Context context, String json) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancel(context, prefs.getString(KEY_LIST, "[]"));
        prefs.edit().putString(KEY_LIST, json).apply();
        schedule(context, json);
    }

    /** Re-arms the stored list, e.g. after a reboot. */
    static void restore(Context context) {
        schedule(context, context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LIST, "[]"));
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel =
                new NotificationChannel(CHANNEL_ID, "Prayer reminders", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("A reminder before each prayer you haven't logged yet.");
            manager.createNotificationChannel(channel);
        }
        if (manager.getNotificationChannel(TASKS_CHANNEL_ID) == null) {
            NotificationChannel channel =
                new NotificationChannel(TASKS_CHANNEL_ID, "Task reminders", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("What's due each day, at the time you choose.");
            manager.createNotificationChannel(channel);
        }
    }

    private static void schedule(Context context, String json) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        long now = System.currentTimeMillis();
        try {
            JSONArray list = new JSONArray(json);
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                long at = item.getLong("at");
                if (at <= now) continue;
                PendingIntent pending = pendingFor(context, item);
                boolean exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms();
                if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
                else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            }
        } catch (Exception ignored) {
            // A malformed list schedules nothing.
        }
    }

    private static void cancel(Context context, String json) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        try {
            JSONArray list = new JSONArray(json);
            for (int i = 0; i < list.length(); i++) alarms.cancel(pendingFor(context, list.getJSONObject(i)));
        } catch (Exception ignored) {
            // Nothing to cancel.
        }
    }

    private static PendingIntent pendingFor(Context context, JSONObject item) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.putExtra("id", item.optString("id"));
        intent.putExtra("title", item.optString("title"));
        intent.putExtra("body", item.optString("body"));
        intent.putExtra("path", item.optString("path", "/"));
        intent.putExtra("channel", item.optString("channel", CHANNEL_ID));
        JSONObject prayer = item.optJSONObject("prayer");
        if (prayer != null) {
            intent.putExtra("prayer_date", prayer.optString("date"));
            intent.putExtra("prayer_name", prayer.optString("name"));
            JSONArray actions = prayer.optJSONArray("actions");
            StringBuilder list = new StringBuilder();
            for (int i = 0; actions != null && i < actions.length() && i < 3; i++) {
                if (list.length() > 0) list.append(",");
                list.append(actions.optString(i));
            }
            intent.putExtra("prayer_actions", list.toString());
        }
        return PendingIntent.getBroadcast(
            context,
            item.optString("id").hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
