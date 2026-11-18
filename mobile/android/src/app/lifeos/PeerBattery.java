package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.BatteryManager;

import org.json.JSONObject;

/**
 * The SIM phone's battery on the main phone. The SIM phone sends its
 * percentage and whether it's charging whenever either changes; the main
 * phone keeps the last reading (shown on the Life Connect card and in the
 * Life Connect notification) and says once at 20% and once at 10% that the
 * SIM phone is running low, ready again after it charges.
 */
final class PeerBattery {
    static final String CHANNEL = "connect_battery";
    private static final int ALERT_ID = 7207;
    private static final String KEY_LEVEL = "peer_battery_level";
    private static final String KEY_CHARGING = "peer_battery_charging";
    private static final String KEY_AT = "peer_battery_at";
    private static final String KEY_ALERTED = "peer_battery_alerted";

    private static int sentLevel = -1;
    private static boolean sentCharging;

    private PeerBattery() {}

    /* ---------------------------------------------------------- SIM phone */

    /** Starts following this phone's battery; returns the receiver to unregister later. */
    static BroadcastReceiver watch(Context context, ConnectConfig config) {
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                report(config, intent, false);
            }
        };
        // Battery changes are sticky: registering also hands over the current reading.
        context.registerReceiver(receiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        return receiver;
    }

    /** Sends the current reading now (e.g. just connected), even if it hasn't changed. */
    static void sendNow(Context context, ConnectConfig config) {
        Intent sticky = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (sticky != null) report(config, sticky, true);
    }

    private static synchronized void report(ConnectConfig config, Intent intent, boolean always) {
        int raw = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        if (raw < 0 || scale <= 0) return;
        int level = Math.round(raw * 100f / scale);
        int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING
            || status == BatteryManager.BATTERY_STATUS_FULL;
        if (!always && !BatteryRules.worthSending(sentLevel, sentCharging, level, charging)) return;
        sentLevel = level;
        sentCharging = charging;
        try {
            ConnectSender.send(config, new JSONObject()
                .put("type", "battery")
                .put("level", level)
                .put("charging", charging)
                .put("device", config.device), null);
        } catch (Exception ignored) {
            // Sent with the next change.
        }
    }

    /* --------------------------------------------------------- main phone */

    /** A reading from the SIM phone: keep it, and alert if it just ran low. */
    static void received(Context context, JSONObject message) {
        int level = message.optInt("level", -1);
        if (level < 0 || level > 100) return;
        boolean charging = message.optBoolean("charging");
        SharedPreferences prefs = prefs(context);
        int alerted = prefs.getInt(KEY_ALERTED, BatteryRules.NONE);
        int alert = BatteryRules.alertFor(level, charging, alerted);
        prefs.edit()
            .putInt(KEY_LEVEL, level)
            .putBoolean(KEY_CHARGING, charging)
            .putLong(KEY_AT, System.currentTimeMillis())
            .putInt(KEY_ALERTED, BatteryRules.nextLastAlerted(level, charging, alerted))
            .apply();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (charging) manager.cancel(ALERT_ID);
        if (alert == 0) return;
        ensureChannel(context);
        String device = message.optString("device", "Your SIM phone");
        Intent open = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open/settings"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_battery)
            .setContentTitle(device + " battery is at " + level + "%")
            .setContentText(alert <= 10 ? "Charge it soon to keep getting its calls here." : "Running low. Calls keep coming here while it has charge.")
            .setContentIntent(PendingIntent.getActivity(context, 7208, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setCategory(Notification.CATEGORY_STATUS)
            .setAutoCancel(true)
            .build();
        manager.notify(ALERT_ID, notification);
    }

    /** The last reading for the web view: {level, charging, at}, or "{}" before the first. */
    static JSONObject last(Context context) {
        SharedPreferences prefs = prefs(context);
        JSONObject out = new JSONObject();
        int level = prefs.getInt(KEY_LEVEL, -1);
        if (level < 0) return out;
        try {
            out.put("level", level)
                .put("charging", prefs.getBoolean(KEY_CHARGING, false))
                .put("at", prefs.getLong(KEY_AT, 0));
        } catch (Exception ignored) {
            // Empty.
        }
        return out;
    }

    /** "64%, charging" for the Life Connect notification; null before the first reading. */
    static String summary(Context context) {
        SharedPreferences prefs = prefs(context);
        int level = prefs.getInt(KEY_LEVEL, -1);
        if (level < 0) return null;
        return level + "%" + (prefs.getBoolean(KEY_CHARGING, false) ? ", charging" : "");
    }

    private static void ensureChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL, "SIM phone battery", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Says when your SIM phone's battery runs low (20% and 10%).");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE);
    }
}
