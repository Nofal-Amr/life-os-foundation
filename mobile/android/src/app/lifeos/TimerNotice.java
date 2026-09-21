package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/** The ongoing "timer running" notification, with a live clock from its start. */
final class TimerNotice {
    private static final String CHANNEL_ID = "timer";
    private static final int ID = 7001;

    private TimerNotice() {}

    static void show(Context context, String title, long startedAt) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel =
                new NotificationChannel(CHANNEL_ID, "Running timer", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows what you're timing while a timer runs.");
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("lifeos://open/time"))
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(
            context, ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setContentText("Timer running · tap to stop it in Life OS")
            .setWhen(startedAt)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_STOPWATCH)
            .setContentIntent(tap)
            .build();
        manager.notify(ID, notification);
    }

    static void clear(Context context) {
        context.getSystemService(NotificationManager.class).cancel(ID);
    }
}
