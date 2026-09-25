package app.lifeos;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/** Shows one reminder; tapping it opens the app on the given page. */
public class ReminderReceiver extends BroadcastReceiver {
    /** "Asr", or "Jumu'ah" for Dhuhr on a Friday, for the confirmation. */
    private static String prayerLabel(String name, String date) {
        try {
            java.time.LocalDate day = java.time.LocalDate.parse(date);
            if ("dhuhr".equals(name) && day.getDayOfWeek() == java.time.DayOfWeek.FRIDAY) return "Jumu'ah";
        } catch (Exception ignored) {
            // Fall through to the plain name.
        }
        return name.isEmpty() ? "Prayer" : Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        Reminders.ensureChannel(context);
        String id = intent.getStringExtra("id");
        String prayerDate = intent.getStringExtra("prayer_date");
        String prayerName = intent.getStringExtra("prayer_name");
        // Logged since this was scheduled (from a notification or the widget): stay quiet.
        if (prayerDate != null && prayerName != null
            && (PrayerWidget.isLogged(context, prayerDate, prayerName)
                || PrayerActionReceiver.isPending(context, prayerDate, prayerName))) {
            return;
        }
        int notificationId = id == null ? 0 : id.hashCode();
        Intent open = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open" + intent.getStringExtra("path")))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(
            context, id == null ? 0 : id.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String channel = intent.getStringExtra("channel");
        Notification.Builder builder = new Notification.Builder(context, channel == null ? Reminders.CHANNEL_ID : channel)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(intent.getStringExtra("title"))
            .setContentText(intent.getStringExtra("body"))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setContentIntent(tap)
            .setAutoCancel(true);

        // Prayer reminders: log it right from the notification.
        String actions = intent.getStringExtra("prayer_actions");
        if (prayerDate != null && prayerName != null && actions != null && !actions.isEmpty()) {
            String label = intent.getStringExtra("title");
            String[] statuses = actions.split(",");
            for (int i = 0; i < statuses.length; i++) {
                Intent log = new Intent(context, PrayerActionReceiver.class)
                    .putExtra("date", prayerDate)
                    .putExtra("name", prayerName)
                    .putExtra("status", statuses[i])
                    .putExtra("label", prayerLabel(prayerName, prayerDate))
                    .putExtra("notification", notificationId);
                PendingIntent pending = PendingIntent.getBroadcast(
                    context, notificationId * 4 + i, log,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                builder.addAction(new Notification.Action.Builder(
                    null, PrayerWidget.label(statuses[i]), pending).build());
            }
        }
        context.getSystemService(NotificationManager.class).notify(notificationId, builder.build());
    }
}
