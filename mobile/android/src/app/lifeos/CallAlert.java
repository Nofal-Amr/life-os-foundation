package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;

import org.json.JSONObject;

/**
 * The main phone's side of Life Connect: rings like a call when the SIM
 * phone does, with Decline and Mute, and leaves a "missed call" behind if
 * nobody picked up.
 */
final class CallAlert {
    static final String CHANNEL_RING = "connect_calls";
    static final String CHANNEL_INFO = "connect_info";
    static final int RING_ID = 7201;
    private static final int MISSED_ID = 7202;

    private CallAlert() {}

    static void ensureChannels(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel ring = new NotificationChannel(
            CHANNEL_RING, "Calls from your SIM phone", NotificationManager.IMPORTANCE_HIGH);
        ring.setDescription("Rings when your SIM phone gets a call.");
        ring.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        ring.enableVibration(true);
        ring.setVibrationPattern(new long[] {0, 800, 600, 800, 600});
        ring.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(ring);
        NotificationChannel info = new NotificationChannel(
            CHANNEL_INFO, "Missed calls from your SIM phone", NotificationManager.IMPORTANCE_DEFAULT);
        manager.createNotificationChannel(info);
    }

    private static String who(JSONObject message) {
        String name = message.optString("name", "");
        String number = message.optString("number", "");
        if (!name.isEmpty()) return name;
        return number.isEmpty() ? "Unknown number" : number;
    }

    /** The call ringing here now, so repeats of the same call don't ring twice. */
    private static volatile String ringingCall = null;

    static void ring(Context context, JSONObject message) {
        String call = message.optString("call", "");
        if (!call.isEmpty() && call.equals(ringingCall)) return;
        ringingCall = call.isEmpty() ? null : call;
        ensureChannels(context);
        String device = message.optString("device", "your SIM phone");
        String number = message.optString("number", "");
        Notification.Builder builder = new Notification.Builder(context, CHANNEL_RING)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(who(message))
            .setContentText("Calling " + device + (number.isEmpty() || who(message).equals(number) ? "" : " · " + number))
            .setCategory(Notification.CATEGORY_CALL)
            // Not "ongoing": watches (Galaxy Watch, Wear OS) never show ongoing
            // notifications, and the call should ring on the wrist too.
            .setAutoCancel(false)
            .setTimeoutAfter(90_000)
            .setContentIntent(open(context))
            .setFullScreenIntent(callScreen(context, message), true);
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            // A real call notification, like Messenger's: the watch rings with
            // it and shows Decline. "Answer" opens the call screen here, since
            // the call itself is picked up on the SIM phone.
            android.app.Person caller = new android.app.Person.Builder()
                .setName(who(message)).setImportant(true).build();
            builder.setStyle(Notification.CallStyle.forIncomingCall(
                    caller, actionIntent(context, "decline", 1), callScreen(context, message)))
                .addAction(action(context, "mute", "Mute", 2));
        } else {
            builder.addAction(action(context, "decline", "Decline", 1))
                .addAction(action(context, "mute", "Mute", 2));
        }
        Notification notification = builder.build();
        // Keep ringing until answered, declined or muted, like a call.
        notification.flags |= Notification.FLAG_INSISTENT;
        context.getSystemService(NotificationManager.class).notify(RING_ID, notification);
    }

    /** Muted here: keep showing the call, without the sound. */
    static void silence(Context context, String title, String text) {
        Notification notification = new Notification.Builder(context, CHANNEL_INFO)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(Notification.CATEGORY_CALL)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(90_000)
            .addAction(action(context, "decline", "Decline", 1))
            .build();
        context.getSystemService(NotificationManager.class).notify(RING_ID, notification);
    }

    static void answered(Context context, JSONObject message) {
        ringingCall = null;
        context.getSystemService(NotificationManager.class).cancel(RING_ID);
        IncomingCallActivity.close();
    }

    static void ended(Context context, JSONObject message) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.cancel(RING_ID);
        IncomingCallActivity.close();
        ringingCall = null;
        if (!message.optBoolean("missed")) return;
        ensureChannels(context);
        manager.notify(MISSED_ID, new Notification.Builder(context, CHANNEL_INFO)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle("Missed call: " + who(message))
            .setContentText("On " + message.optString("device", "your SIM phone"))
            .setCategory(Notification.CATEGORY_MISSED_CALL)
            .setAutoCancel(true)
            .build());
    }

    static void test(Context context, JSONObject message) {
        ensureChannels(context);
        context.getSystemService(NotificationManager.class).notify(MISSED_ID,
            new Notification.Builder(context, CHANNEL_INFO)
                .setSmallIcon(R.drawable.ic_stat_prayer)
                .setContentTitle("Life Connect works")
                .setContentText("Test from " + message.optString("device", "your other phone"))
                .setAutoCancel(true)
                .setTimeoutAfter(15_000)
                .build());
    }

    /** The full-screen call screen, over the lock screen too. */
    private static PendingIntent callScreen(Context context, JSONObject message) {
        String number = message.optString("number", "");
        Intent intent = new Intent(context, IncomingCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION)
            .putExtra("who", who(message))
            .putExtra("number", number)
            .putExtra("device", message.optString("device", "your SIM phone"));
        return PendingIntent.getActivity(context, 7205, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent open(Context context) {
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 7204, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Notification.Action action(Context context, String what, String label, int code) {
        return new Notification.Action.Builder(null, label, actionIntent(context, what, code)).build();
    }

    private static PendingIntent actionIntent(Context context, String what, int code) {
        Intent intent = new Intent(context, ConnectActionReceiver.class).setAction("app.lifeos.CONNECT_" + what);
        return PendingIntent.getBroadcast(context, 7210 + code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
