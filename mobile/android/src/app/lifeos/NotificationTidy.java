package app.lifeos;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.List;

/**
 * Keeps Life OS's notifications from piling up. Android drops an app's new
 * notifications once it has about 50 showing, and a long pile buries the next
 * prayer. So:
 * - reminders for the same thing share one notification (a prayer's "before",
 *   "now" and "last minutes" replace each other; one water reminder at a time);
 * - a new prayer reminder clears the previous prayer's;
 * - water and task reminders expire on their own;
 * - past {@link #MAX_SHOWN}, the oldest ones go first.
 */
final class NotificationTidy {
    static final int MAX_SHOWN = 20;

    private NotificationTidy() {}

    /** Before posting `id` on `channel`: clear what it replaces and keep the total down. */
    static void beforePost(Context context, String channel, int id) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        StatusBarNotification[] shown;
        try {
            shown = manager.getActiveNotifications();
        } catch (Exception e) {
            return;
        }
        List<StatusBarNotification> removable = new ArrayList<>();
        for (StatusBarNotification item : shown) {
            Notification notification = item.getNotification();
            if (item.getId() == id) continue;
            boolean ongoing = (notification.flags & (Notification.FLAG_ONGOING_EVENT
                | Notification.FLAG_FOREGROUND_SERVICE)) != 0;
            if (ongoing || item.getId() == CallAlert.RING_ID) continue;
            // Only one prayer reminder at a time: the newest prayer wins.
            if (Reminders.CHANNEL_ID.equals(channel) && Reminders.CHANNEL_ID.equals(notification.getChannelId())) {
                manager.cancel(item.getTag(), item.getId());
                continue;
            }
            removable.add(item);
        }
        // Leave room for the one being posted.
        int over = removable.size() - (MAX_SHOWN - 1);
        if (over <= 0) return;
        removable.sort((a, b) -> Long.compare(a.getPostTime(), b.getPostTime()));
        for (int i = 0; i < over; i++) manager.cancel(removable.get(i).getTag(), removable.get(i).getId());
    }
}
