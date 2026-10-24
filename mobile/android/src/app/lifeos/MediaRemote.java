package app.lifeos;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * The SIM phone's side of the Life Connect music remote: play, pause, skip
 * and volume for whatever is playing here (Spotify, YouTube Music, anything
 * with a media session), sent from the main phone.
 *
 * Playback and volume work in every build: media keys go to the app that's
 * playing, and the music volume needs no permission. What's playing (song,
 * artist, app) needs notification access, which only the Full build asks
 * for; without it the main phone sees "Playing" or "Paused" and the volume.
 *
 * Track changes are only reported for half an hour after the main phone last
 * used the remote, so the relay stays quiet the rest of the time.
 */
final class MediaRemote {
    private static final long WATCH_MS = 30 * 60_000L;
    private static final long REPORT_GAP_MS = 1_200L;

    private static volatile long watchUntil = 0;
    private static volatile long lastReport = 0;
    private static volatile boolean reportQueued = false;
    private static MediaSessionManager.OnActiveSessionsChangedListener sessionsListener;
    private static final List<MediaController> watched = new ArrayList<>();
    private static final MediaController.Callback CALLBACK = new MediaController.Callback() {
        @Override
        public void onPlaybackStateChanged(PlaybackState state) {
            changed();
        }

        @Override
        public void onMetadataChanged(MediaMetadata metadata) {
            changed();
        }
    };
    private static Context appContext;

    private MediaRemote() {}

    /** A command from the main phone: {action: toggle|play|pause|next|previous|vol_up|vol_down|vol_set|status, level?}. */
    static void handle(Context context, ConnectConfig config, JSONObject message) {
        appContext = context.getApplicationContext();
        watchUntil = SystemClock.elapsedRealtime() + WATCH_MS;
        startWatching(appContext);
        AudioManager audio = context.getSystemService(AudioManager.class);
        MediaController controller = active(context);
        String action = message.optString("action");
        try {
            switch (action) {
                case "toggle":
                    if (controller != null) {
                        if (playing(controller)) controller.getTransportControls().pause();
                        else controller.getTransportControls().play();
                    } else {
                        key(audio, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE);
                    }
                    break;
                case "play":
                    if (controller != null) controller.getTransportControls().play();
                    else key(audio, KeyEvent.KEYCODE_MEDIA_PLAY);
                    break;
                case "pause":
                    if (controller != null) controller.getTransportControls().pause();
                    else key(audio, KeyEvent.KEYCODE_MEDIA_PAUSE);
                    break;
                case "next":
                    if (controller != null) controller.getTransportControls().skipToNext();
                    else key(audio, KeyEvent.KEYCODE_MEDIA_NEXT);
                    break;
                case "previous":
                    if (controller != null) controller.getTransportControls().skipToPrevious();
                    else key(audio, KeyEvent.KEYCODE_MEDIA_PREVIOUS);
                    break;
                case "vol_up":
                    audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, 0);
                    break;
                case "vol_down":
                    audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, 0);
                    break;
                case "vol_set": {
                    int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int level = Math.max(0, Math.min(max, message.optInt("level", audio.getStreamVolume(AudioManager.STREAM_MUSIC))));
                    audio.setStreamVolume(AudioManager.STREAM_MUSIC, level, 0);
                    break;
                }
                case "status":
                default:
                    break;
            }
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect: media " + action + " failed");
        }
        // Report once the player has had a moment to react.
        ConnectSender.run(() -> {
            try {
                Thread.sleep("status".equals(action) ? 0 : 700);
            } catch (InterruptedException ignored) {
                return;
            }
            report(appContext, config);
        });
    }

    /** Sends what's playing and the volume to the main phone. */
    static void report(Context context, ConnectConfig config) {
        if (context == null || config == null) return;
        lastReport = SystemClock.elapsedRealtime();
        try {
            AudioManager audio = context.getSystemService(AudioManager.class);
            JSONObject state = new JSONObject()
                .put("type", "media_state")
                .put("device", config.device)
                .put("volume", audio.getStreamVolume(AudioManager.STREAM_MUSIC))
                .put("max", audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            MediaController controller = active(context);
            if (controller != null) {
                MediaMetadata meta = controller.getMetadata();
                state.put("known", true)
                    .put("playing", playing(controller))
                    .put("title", meta == null ? "" : text(meta.getString(MediaMetadata.METADATA_KEY_TITLE)))
                    .put("artist", meta == null ? "" : text(firstNonEmpty(meta.getString(MediaMetadata.METADATA_KEY_ARTIST), meta.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST))))
                    .put("app", label(context, controller.getPackageName()));
            } else {
                state.put("known", false).put("playing", audio.isMusicActive());
            }
            ConnectSender.send(config, state, null);
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect: couldn't report media state");
        }
    }

    /** A track or play state changed here: tell the main phone, at most about once a second, while it's watching. */
    private static void changed() {
        if (SystemClock.elapsedRealtime() > watchUntil || reportQueued) return;
        Context context = appContext;
        ConnectConfig config = context == null ? null : ConnectConfig.load(context);
        if (config == null || !"sim".equals(config.role)) return;
        long wait = Math.max(0, REPORT_GAP_MS - (SystemClock.elapsedRealtime() - lastReport));
        reportQueued = true;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            reportQueued = false;
            ConnectSender.run(() -> report(context, config));
        }, wait);
    }

    /** Follows the media sessions here (Full build, with notification access), so track changes can be reported. */
    private static synchronized void startWatching(Context context) {
        if (sessionsListener != null) return;
        try {
            MediaSessionManager manager = context.getSystemService(MediaSessionManager.class);
            ComponentName listener = new ComponentName(context, SpendingListener.class);
            sessionsListener = controllers -> {
                synchronized (MediaRemote.class) {
                    for (MediaController old : watched) old.unregisterCallback(CALLBACK);
                    watched.clear();
                    if (controllers != null) {
                        for (MediaController controller : controllers) {
                            controller.registerCallback(CALLBACK, new Handler(Looper.getMainLooper()));
                            watched.add(controller);
                        }
                    }
                }
                changed();
            };
            manager.addOnActiveSessionsChangedListener(sessionsListener, listener, new Handler(Looper.getMainLooper()));
            sessionsListener.onActiveSessionsChanged(manager.getActiveSessions(listener));
        } catch (SecurityException e) {
            // No notification access (the standard build): commands still work, without track names.
            sessionsListener = null;
        } catch (Exception e) {
            sessionsListener = null;
        }
    }

    /** The session that's playing, else the most recent one; null without notification access. */
    private static MediaController active(Context context) {
        try {
            MediaSessionManager manager = context.getSystemService(MediaSessionManager.class);
            List<MediaController> list = manager.getActiveSessions(new ComponentName(context, SpendingListener.class));
            for (MediaController controller : list) if (playing(controller)) return controller;
            return list.isEmpty() ? null : list.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean playing(MediaController controller) {
        PlaybackState state = controller.getPlaybackState();
        return state != null && state.getState() == PlaybackState.STATE_PLAYING;
    }

    /** Without notification access: a media key goes to whichever app is playing. */
    private static void key(AudioManager audio, int code) {
        audio.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
        audio.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
    }

    private static String label(Context context, String pkg) {
        try {
            PackageManager pm = context.getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String firstNonEmpty(String a, String b) {
        return a != null && !a.isEmpty() ? a : b;
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
