package app.lifeos;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.telecom.TelecomManager;
import android.util.Log;

/** The SIM phone's side of Decline / Mute from the main phone. */
final class CallControl {
    private static final String KEY_MUTED = "muted_ring";

    private CallControl() {}

    @SuppressWarnings("deprecation")
    static void decline(Context context) {
        if (context.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            Log.w("LifeOS", "Life Connect: no permission to end calls");
            return;
        }
        try {
            context.getSystemService(TelecomManager.class).endCall();
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect: couldn't end the call");
        }
    }

    /** Silences the ringtone; it comes back when the call ends (see unmute). */
    static void mute(Context context) {
        try {
            context.getSystemService(TelecomManager.class).silenceRinger();
            return;
        } catch (Exception ignored) {
            // Only the default phone app may; fall back to muting the ring volume.
        }
        try {
            context.getSystemService(AudioManager.class)
                .adjustStreamVolume(AudioManager.STREAM_RING, AudioManager.ADJUST_MUTE, 0);
            prefs(context).edit().putBoolean(KEY_MUTED, true).apply();
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect: couldn't mute the ringtone");
        }
    }

    static void unmute(Context context) {
        if (!prefs(context).getBoolean(KEY_MUTED, false)) return;
        prefs(context).edit().remove(KEY_MUTED).apply();
        try {
            context.getSystemService(AudioManager.class)
                .adjustStreamVolume(AudioManager.STREAM_RING, AudioManager.ADJUST_UNMUTE, 0);
        } catch (Exception ignored) {
            // Nothing to restore.
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE);
    }
}
