package app.lifeos;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

/**
 * Watches notifications from the bank and wallet apps (and SMS senders) you
 * chose, and turns spending into a "Log it?" question. Everything else is
 * passed over: other apps are only noted by name so you can pick them, and a
 * message is read only far enough to see it's spending — one-time codes are
 * dropped unread (see SpendingParser). On the SIM phone of a Life Connect
 * pair, the question goes to the main phone instead.
 */
public class SpendingListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handle(sbn);
        } catch (Exception ignored) {
            // Never let one odd notification stop the listener.
        }
    }

    private void handle(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (pkg == null || pkg.equals(getPackageName())) return;
        SpendingStore.noteSeen(this, pkg, label(pkg));
        if (!SpendingStore.watches(this, pkg)) return;

        Notification notification = sbn.getNotification();
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle extras = notification.extras;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (body.isEmpty()) return;

        boolean sms = SpendingStore.isMessagingApp(pkg);
        if (sms && !SpendingStore.senderAllowed(this, title)) return;

        SpendingParser.Spend spend = SpendingParser.parse(sms ? body : title + "\n" + body);
        if (spend == null) return;
        String fingerprint = pkg + ":" + Integer.toHexString((title + body).hashCode());
        if (SpendingStore.recentlyHandled(this, fingerprint)) return;

        String source = sms ? title : label(pkg);
        long at = sbn.getPostTime();
        ConnectConfig connect = ConnectConfig.load(this);
        if (connect != null && "sim".equals(connect.role)) {
            try {
                ConnectSender.send(connect, new JSONObject()
                    .put("type", "spend")
                    .put("amount", spend.amount)
                    .put("currency", spend.currency)
                    .put("merchant", spend.merchant == null ? "" : spend.merchant)
                    .put("source", source)
                    .put("spentAt", at), ok -> {
                        // The relay was down: ask here instead, so nothing is lost.
                        if (!ok) SpendingStore.add(this, spend.amount, spend.currency, spend.merchant, source, at);
                    });
            } catch (Exception e) {
                SpendingStore.add(this, spend.amount, spend.currency, spend.merchant, source, at);
            }
            return;
        }
        SpendingStore.add(this, spend.amount, spend.currency, spend.merchant, source, at);
    }

    private String label(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
