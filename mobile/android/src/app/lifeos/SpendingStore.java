package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.UUID;

/**
 * Spending picked up from bank notifications, waiting for a yes or no:
 * "Spent 250 EGP at Carrefour?" with Log it / Not spending. Only the amount,
 * currency, shop and app name are kept — never the message itself. The
 * app collects the answered ones when it opens and writes them to Money.
 */
final class SpendingStore {
    static final String PREFS = "spending";
    static final String CHANNEL = "spending";
    private static final String KEY_PENDING = "pending";
    private static final String KEY_WATCH = "watch";
    private static final String KEY_SEEN = "seen";
    private static final String KEY_RECENT = "recent";

    /** SMS apps: only messages from the senders you list count. */
    static final String[] MESSAGING_APPS = {
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.android.messaging",
    };

    private SpendingStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isMessagingApp(String pkg) {
        for (String app : MESSAGING_APPS) if (app.equals(pkg)) return true;
        return false;
    }

    /* ------------------------------------------------------------ watch list */

    /** {packages: [...], senders: [...]} as chosen in Settings. */
    static JSONObject watch(Context context) {
        try {
            return new JSONObject(prefs(context).getString(KEY_WATCH, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void setWatch(Context context, String json) {
        try {
            JSONObject value = new JSONObject(json);
            JSONObject clean = new JSONObject()
                .put("packages", value.optJSONArray("packages") == null ? new JSONArray() : value.optJSONArray("packages"))
                .put("senders", value.optJSONArray("senders") == null ? new JSONArray() : value.optJSONArray("senders"));
            prefs(context).edit().putString(KEY_WATCH, clean.toString()).apply();
        } catch (Exception ignored) {
            // Keep the old list.
        }
    }

    static boolean watches(Context context, String pkg) {
        JSONArray packages = watch(context).optJSONArray("packages");
        for (int i = 0; packages != null && i < packages.length(); i++) {
            if (pkg.equals(packages.optString(i))) return true;
        }
        return false;
    }

    /** For an SMS app: is this sender one of yours (e.g. "CIB", "InstaPay")? */
    static boolean senderAllowed(Context context, String title) {
        if (title == null) return false;
        String sender = title.toLowerCase(Locale.ROOT);
        JSONArray senders = watch(context).optJSONArray("senders");
        for (int i = 0; senders != null && i < senders.length(); i++) {
            String name = senders.optString(i).trim().toLowerCase(Locale.ROOT);
            if (!name.isEmpty() && sender.contains(name)) return true;
        }
        return false;
    }

    /* ---------------------------------------------------------- seen apps */

    /** Remembers which apps post notifications (name only), to choose from in Settings. */
    static void noteSeen(Context context, String pkg, String label) {
        try {
            JSONObject seen = new JSONObject(prefs(context).getString(KEY_SEEN, "{}"));
            if (seen.has(pkg)) return;
            if (seen.length() >= 60) return;
            seen.put(pkg, label);
            prefs(context).edit().putString(KEY_SEEN, seen.toString()).apply();
        } catch (Exception ignored) {
            // Not important.
        }
    }

    static JSONObject seen(Context context) {
        try {
            return new JSONObject(prefs(context).getString(KEY_SEEN, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** True if this exact message was handled in the last while (apps re-post). */
    static boolean recentlyHandled(Context context, String fingerprint) {
        try {
            JSONArray recent = new JSONArray(prefs(context).getString(KEY_RECENT, "[]"));
            for (int i = 0; i < recent.length(); i++) if (fingerprint.equals(recent.optString(i))) return true;
            JSONArray next = new JSONArray().put(fingerprint);
            for (int i = 0; i < recent.length() && i < 30; i++) next.put(recent.optString(i));
            prefs(context).edit().putString(KEY_RECENT, next.toString()).apply();
        } catch (Exception ignored) {
            // Treat as new.
        }
        return false;
    }

    /* ------------------------------------------------------------- pending */

    static synchronized void add(Context context, double amount, String currency, String merchant, String source, long at) {
        try {
            JSONArray list = new JSONArray(prefs(context).getString(KEY_PENDING, "[]"));
            String id = UUID.randomUUID().toString();
            JSONObject item = new JSONObject()
                .put("id", id)
                .put("amount", amount)
                .put("currency", currency)
                .put("merchant", merchant == null ? "" : merchant)
                .put("source", source == null ? "" : source)
                .put("at", at)
                .put("status", "new");
            JSONArray next = new JSONArray().put(item);
            for (int i = 0; i < list.length() && i < 49; i++) next.put(list.get(i));
            prefs(context).edit().putString(KEY_PENDING, next.toString()).apply();
            notifyAsk(context, item);
        } catch (Exception ignored) {
            // Dropped.
        }
    }

    static synchronized String pending(Context context) {
        return prefs(context).getString(KEY_PENDING, "[]");
    }

    /** status: "log" (yes), "dismiss" (no) or "done" (written to Money). */
    static synchronized void resolve(Context context, String id, String status) {
        try {
            JSONArray list = new JSONArray(prefs(context).getString(KEY_PENDING, "[]"));
            JSONArray next = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (!id.equals(item.optString("id"))) {
                    next.put(item);
                } else if ("log".equals(status)) {
                    next.put(item.put("status", "log"));
                }
                // "dismiss" and "done" drop it.
            }
            prefs(context).edit().putString(KEY_PENDING, next.toString()).apply();
            context.getSystemService(NotificationManager.class).cancel(notificationId(id));
        } catch (Exception ignored) {
            // Nothing to change.
        }
    }

    private static int notificationId(String id) {
        return 7300 + Math.abs(id.hashCode() % 1000);
    }

    private static void notifyAsk(Context context, JSONObject item) throws Exception {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL, "Spending from bank notifications", NotificationManager.IMPORTANCE_DEFAULT));
        String id = item.getString("id");
        String amount = String.format(Locale.ROOT, "%,.2f", item.getDouble("amount")).replace(".00", "");
        String merchant = item.optString("merchant");
        String title = "Spent " + amount + " " + item.optString("currency")
            + (merchant.isEmpty() ? "?" : " at " + merchant + "?");
        String source = item.optString("source");
        Intent open = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(android.net.Uri.parse("lifeos://open/finance"));
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle(title)
            .setContentText((source.isEmpty() ? "" : "From " + source + ". ") + "Log it to Money?")
            .setContentIntent(PendingIntent.getActivity(context, notificationId(id), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setAutoCancel(true)
            .addAction(action(context, id, "log", "Log it"))
            .addAction(action(context, id, "dismiss", "Not spending"))
            .build();
        manager.notify(notificationId(id), notification);
    }

    private static Notification.Action action(Context context, String id, String status, String label) {
        Intent intent = new Intent(context, SpendingActionReceiver.class)
            .putExtra("id", id)
            .putExtra("status", status);
        int code = notificationId(id) * 2 + ("log".equals(status) ? 0 : 1);
        PendingIntent pending = PendingIntent.getBroadcast(context, code, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(null, label, pending).build();
    }
}
