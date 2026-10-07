package app.lifeos;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * SMS through Life Connect. On the main phone: shows each SMS the SIM phone
 * got, with a Reply box. On the SIM phone: sends your reply as a real SMS.
 */
final class SmsAlert {
    static final String CHANNEL = "connect_sms";
    static final String KEY_REPLY = "reply";

    private SmsAlert() {}

    private static int idFor(String from) {
        return 7400 + Math.abs((from == null ? "" : from).hashCode() % 500);
    }

    static void show(Context context, JSONObject message) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL, "SMS from your SIM phone", NotificationManager.IMPORTANCE_HIGH);
        manager.createNotificationChannel(channel);

        String from = message.optString("from");
        String name = message.optString("name");
        String who = name.isEmpty() ? (from.isEmpty() ? "Unknown" : from) : name;
        Person sender = new Person.Builder().setName(who).setKey(from).build();
        Person me = new Person.Builder().setName("You").build();
        Notification.MessagingStyle style = new Notification.MessagingStyle(me)
            .addMessage(message.optString("body"), message.optLong("smsAt", System.currentTimeMillis()), sender);

        Intent replyIntent = new Intent(context, ConnectActionReceiver.class)
            .setAction("app.lifeos.CONNECT_reply")
            .putExtra("to", from)
            .putExtra("who", who);
        PendingIntent replyPending = PendingIntent.getBroadcast(context, idFor(from), replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        Notification.Action reply = new Notification.Action.Builder(null, "Reply", replyPending)
            .addRemoteInput(new RemoteInput.Builder(KEY_REPLY).setLabel("Reply from " + message.optString("device", "SIM phone")).build())
            .setAllowGeneratedReplies(true)
            .build();

        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setStyle(style)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setSubText("on " + message.optString("device", "your SIM phone"))
            .setAutoCancel(true)
            .addAction(reply)
            .build();
        manager.notify(idFor(from), notification);
    }

    /** After a reply: update the conversation so it shows what was sent. */
    static void replied(Context context, String to, String who, String text, boolean sent) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(sent ? "Sent to " + who : "Couldn't send to " + who)
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(8000)
            .setAutoCancel(true)
            .build();
        manager.notify(idFor(to), notification);
    }

    /** On the SIM phone: send the reply as an SMS. */
    static void send(Context context, JSONObject message) {
        if (context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            Log.w("LifeOS", "Life Connect: no permission to send SMS");
            return;
        }
        String to = message.optString("to");
        String body = message.optString("body");
        if (to.isEmpty() || body.isEmpty() || body.length() > 1600) return;
        try {
            SmsManager sms = context.getSystemService(SmsManager.class);
            ArrayList<String> parts = sms.divideMessage(body);
            if (parts.size() == 1) sms.sendTextMessage(to, null, body, null, null);
            else sms.sendMultipartTextMessage(to, null, parts, null, null);
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect: SMS not sent");
        }
    }
}
