package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;

import org.json.JSONObject;

/**
 * The main phone's side of the music remote: a quiet media-style
 * notification for what's playing on the SIM phone, with Previous,
 * Play/Pause, Next and volume buttons (on the lock screen and the watch
 * too), and the last state for the remote on the Life Connect card.
 */
final class MediaAlert {
    static final String CHANNEL = "connect_media";
    static final int ID = 7206;
    private static final String KEY_STATE = "media_state";

    /** Tells the web view a new state arrived (set by MainActivity while it's open). */
    static volatile Runnable onState;

    private MediaAlert() {}

    static void ensureChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Music on your SIM phone", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Controls for what's playing on your SIM phone.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    /** A state from the SIM phone: keep it, and show or refresh the controls. */
    static void show(Context context, JSONObject state) {
        context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_STATE, state.toString())
            .apply();
        Runnable listener = onState;
        if (listener != null) listener.run();
        ensureChannel(context);

        boolean playing = state.optBoolean("playing");
        String device = state.optString("device", "your SIM phone");
        String title = state.optString("title", "");
        String artist = state.optString("artist", "");
        String app = state.optString("app", "");
        int volume = state.optInt("volume");
        int max = Math.max(1, state.optInt("max", 15));
        String heading = !title.isEmpty() ? title : playing ? "Playing on " + device : "Paused on " + device;
        StringBuilder detail = new StringBuilder();
        if (!artist.isEmpty()) detail.append(artist);
        if (!app.isEmpty()) detail.append(detail.length() > 0 ? " · " : "").append(app);
        if (!title.isEmpty()) detail.append(detail.length() > 0 ? " · " : "").append("on ").append(device);
        detail.append(detail.length() > 0 ? " · " : "").append("Volume ").append(Math.round(volume * 100f / max)).append("%");

        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(heading)
            .setContentText(detail.toString())
            .setContentIntent(open(context))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setStyle(new Notification.MediaStyle().setShowActionsInCompactView(1, 2, 3))
            .addAction(action(context, "vol_down", R.drawable.ic_media_vol_down, "Volume down", 1))
            .addAction(action(context, "previous", R.drawable.ic_media_prev, "Previous", 2))
            .addAction(action(context, "toggle", playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play, playing ? "Pause" : "Play", 3))
            .addAction(action(context, "next", R.drawable.ic_media_next, "Next", 4))
            .addAction(action(context, "vol_up", R.drawable.ic_media_vol_up, "Volume up", 5))
            .build();
        context.getSystemService(NotificationManager.class).notify(ID, notification);
    }

    /** The last state heard from the SIM phone, with when it came; "{}" if none. */
    static String last(Context context) {
        return context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, "{}");
    }

    /** Sends one command to the SIM phone. */
    static void send(Context context, String action, int level) {
        ConnectConfig config = ConnectConfig.load(context);
        if (config == null || !"main".equals(config.role)) return;
        try {
            JSONObject message = new JSONObject().put("type", "media").put("action", action);
            if ("vol_set".equals(action)) message.put("level", level);
            ConnectSender.send(config, message, null);
        } catch (Exception ignored) {
            // Nothing sent.
        }
    }

    private static Notification.Action action(Context context, String what, int icon, String label, int code) {
        Intent intent = new Intent(context, ConnectActionReceiver.class).setAction("app.lifeos.CONNECT_media_" + what);
        PendingIntent pending = PendingIntent.getBroadcast(context, 7230 + code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(Icon.createWithResource(context, icon), label, pending).build();
    }

    private static PendingIntent open(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(android.net.Uri.parse("lifeos://open/settings"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 7229, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
