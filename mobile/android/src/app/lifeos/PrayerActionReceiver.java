package app.lifeos;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * A "In jamaah" / "On time" / "Clutch" button on a prayer notification.
 * Logs the prayer without opening the app: the log waits here until the app
 * next opens and saves it to your account; the widget shows it at once.
 */
public class PrayerActionReceiver extends BroadcastReceiver {
    static final String PREFS = "pending_prayers";
    static final String KEY_LIST = "list";

    @Override
    public void onReceive(Context context, Intent intent) {
        String date = intent.getStringExtra("date");
        String name = intent.getStringExtra("name");
        String status = intent.getStringExtra("status");
        String label = intent.getStringExtra("label");
        int notificationId = intent.getIntExtra("notification", 0);
        if (date == null || name == null || status == null) return;
        if (!status.matches("jamaah|on_time|clutch|late|missed")) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray list = new JSONArray(prefs.getString(KEY_LIST, "[]"));
            JSONObject log = new JSONObject();
            log.put("date", date);
            log.put("name", name);
            log.put("status", status);
            log.put("at", System.currentTimeMillis());
            list.put(log);
            prefs.edit().putString(KEY_LIST, list.toString()).apply();
        } catch (Exception ignored) {
            return;
        }
        PrayerWidget.markLogged(context, date, name, status);

        // Swap the reminder for a short confirmation that clears itself.
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.cancel(notificationId);
        Reminders.ensureChannel(context);
        Notification done = new Notification.Builder(context, Reminders.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle((label == null ? "Prayer" : label) + " logged")
            .setContentText(PrayerWidget.label(status))
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(4000)
            .setAutoCancel(true)
            .build();
        manager.notify(notificationId, done);
    }

    /** Hands the waiting logs to the app and forgets them. */
    static String take(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String list = prefs.getString(KEY_LIST, "[]");
        prefs.edit().remove(KEY_LIST).apply();
        return list;
    }

    /** Whether a log for this prayer is waiting to be saved. */
    static boolean isPending(Context context, String date, String name) {
        try {
            JSONArray list = new JSONArray(
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LIST, "[]"));
            for (int i = 0; i < list.length(); i++) {
                JSONObject log = list.getJSONObject(i);
                if (date.equals(log.optString("date")) && name.equals(log.optString("name"))) return true;
            }
        } catch (Exception ignored) {
            // Nothing waiting.
        }
        return false;
    }
}
