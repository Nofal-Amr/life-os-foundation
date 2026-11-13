package app.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

/**
 * Find my phone, on the phone being looked for: rings the alarm sound at
 * full volume (it plays even on silent or vibrate) and/or blinks the torch,
 * for a minute, or until Stop, or until someone picks the phone up.
 */
final class FindPhone {
    static final String CHANNEL = "connect_find";
    static final int NOTIFICATION_ID = 7230;
    private static final String TAG = "LifeOS";

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static Context app;
    private static long startedAt;
    private static boolean active;
    private static MediaPlayer player;
    private static int originalVolume = -1;
    private static int raisedVolume = -1;
    private static String torchId;
    private static boolean torchLit;
    private static PowerManager.WakeLock wake;
    private static BroadcastReceiver pickedUp;

    private FindPhone() {}

    static void ensureChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL, "Find this phone", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Shown while your other phone is looking for this one.");
        // The sound comes from the alarm player, so it rings even on silent.
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    /** Starts a find (any find already going is replaced). from: who is looking, for the text. */
    static void start(Context context, boolean ring, boolean flash, String from) {
        if (!FindTiming.anything(ring, flash)) return;
        Context appContext = context.getApplicationContext();
        MAIN.post(() -> begin(appContext, ring, flash, from));
    }

    /** Stops a find, if one is going. Safe from any thread. */
    static void stop(Context context) {
        MAIN.post(FindPhone::end);
    }

    private static void begin(Context context, boolean ring, boolean flash, String from) {
        end();
        app = context;
        active = true;
        startedAt = SystemClock.elapsedRealtime();
        PowerManager power = context.getSystemService(PowerManager.class);
        wake = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "lifeos:find");
        wake.acquire(FindTiming.DURATION_MS + 5_000);

        ensureChannel(context);
        context.getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification(context, ring, flash, from));
        if (ring) ring(context);
        if (flash) torchId = torch(context);
        Log.i(TAG, "Find: started (ring=" + ring + ", flash=" + flash + ", torch=" + (torchId != null) + ")");
        watchPickUp(context);
        MAIN.post(TICK);
    }

    private static final Runnable TICK = new Runnable() {
        @Override
        public void run() {
            if (!active) return;
            long elapsed = SystemClock.elapsedRealtime() - startedAt;
            if (FindTiming.timedOut(elapsed)) {
                Log.i(TAG, "Find: a minute passed, stopping");
                end();
                return;
            }
            if (torchId != null) setTorch(FindTiming.torchOn(elapsed));
            MAIN.postDelayed(this, FindTiming.TICK_MS);
        }
    };

    private static void ring(Context context) {
        AudioManager audio = context.getSystemService(AudioManager.class);
        try {
            originalVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM);
            raisedVolume = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            audio.setStreamVolume(AudioManager.STREAM_ALARM, raisedVolume, 0);
        } catch (Exception e) {
            Log.w(TAG, "Find: couldn't raise the alarm volume: " + e.getClass().getSimpleName());
            originalVolume = -1;
        }
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        try {
            MediaPlayer media = new MediaPlayer();
            media.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            media.setDataSource(context, sound);
            media.setLooping(true);
            media.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK);
            media.prepare();
            media.start();
            player = media;
        } catch (Exception e) {
            Log.w(TAG, "Find: couldn't play the alarm sound: " + e.getClass().getSimpleName());
        }
    }

    /** The back camera's flash, or null if this phone has none. */
    private static String torch(Context context) {
        try {
            CameraManager cameras = context.getSystemService(CameraManager.class);
            for (String id : cameras.getCameraIdList()) {
                Boolean has = cameras.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (Boolean.TRUE.equals(has)) return id;
            }
            Log.i(TAG, "Find: no flash on this phone, ringing only");
        } catch (Exception e) {
            Log.w(TAG, "Find: couldn't reach the flash: " + e.getClass().getSimpleName());
        }
        return null;
    }

    private static void setTorch(boolean on) {
        if (torchId == null || app == null || on == torchLit) return;
        try {
            app.getSystemService(CameraManager.class).setTorchMode(torchId, on);
            torchLit = on;
        } catch (Exception e) {
            // The camera is in use by another app, or went away: stop flashing.
            Log.w(TAG, "Find: flash stopped: " + e.getClass().getSimpleName());
            torchId = null;
        }
    }

    /** Unlocking the phone or turning its screen on means it was found. */
    private static void watchPickUp(Context context) {
        pickedUp = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                if (!active) return;
                if (FindTiming.screenStops(SystemClock.elapsedRealtime() - startedAt)) {
                    Log.i(TAG, "Find: picked up (" + intent.getAction() + "), stopping");
                    end();
                }
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                context.registerReceiver(pickedUp, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(pickedUp, filter);
            }
        } catch (Exception e) {
            pickedUp = null;
        }
    }

    private static void end() {
        MAIN.removeCallbacks(TICK);
        boolean was = active;
        active = false;
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
                // Already stopped.
            }
            player.release();
            player = null;
        }
        if (app != null) {
            if (originalVolume >= 0) {
                try {
                    AudioManager audio = app.getSystemService(AudioManager.class);
                    int target = FindTiming.restoreTo(originalVolume, raisedVolume,
                        audio.getStreamVolume(AudioManager.STREAM_ALARM));
                    if (target >= 0) audio.setStreamVolume(AudioManager.STREAM_ALARM, target, 0);
                } catch (Exception ignored) {
                    // Volume left as it is.
                }
            }
            setTorch(false);
            if (pickedUp != null) {
                try {
                    app.unregisterReceiver(pickedUp);
                } catch (Exception ignored) {
                    // Already gone.
                }
            }
            app.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        }
        pickedUp = null;
        originalVolume = -1;
        raisedVolume = -1;
        torchId = null;
        torchLit = false;
        if (wake != null && wake.isHeld()) wake.release();
        wake = null;
        if (was) Log.i(TAG, "Find: stopped");
    }

    private static Notification notification(Context context, boolean ring, boolean flash, String from) {
        String doing = ring && flash ? "Ringing and flashing" : ring ? "Ringing" : "Flashing";
        String who = from == null || from.isEmpty() ? "your other phone" : from;
        Intent stopIntent = new Intent(context, ConnectActionReceiver.class).setAction("app.lifeos.CONNECT_findstop");
        PendingIntent stop = PendingIntent.getBroadcast(context, 7231, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_prayer)
            .setContentTitle("Here I am")
            .setContentText(doing + " so you can find this phone. Asked from " + who + ".")
            .setCategory(Notification.CATEGORY_ALARM)
            .setTimeoutAfter(FindTiming.DURATION_MS)
            .setDeleteIntent(stop)
            .setContentIntent(stop)
            .addAction(new Notification.Action.Builder(null, "Stop", stop).build())
            .build();
    }
}
