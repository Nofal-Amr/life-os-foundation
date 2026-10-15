package app.lifeos;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.telephony.TelephonyManager;

import org.json.JSONObject;

/**
 * The SIM phone's side of Life Connect: when a call comes in, tells the main
 * phone who's calling; when it's picked up or ends, says so, so the main
 * phone stops ringing (and shows a missed call if nobody answered).
 */
public class CallStateReceiver extends BroadcastReceiver {
    private static final String KEY_STATE = "last_state";
    private static final String KEY_NUMBER = "last_number";
    private static final String KEY_NAME = "last_name";
    private static final String KEY_SENT = "ring_sent_at";
    private static final String KEY_CALL = "call_id";
    /** How often, and for how long, a ringing call is announced again. */
    private static final long RESEND_EVERY_MS = 5_000;
    private static final long RESEND_FOR_MS = 45_000;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(intent.getAction())) return;
        ConnectConfig config = ConnectConfig.load(context);
        if (config == null || !"sim".equals(config.role)) return;

        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        @SuppressWarnings("deprecation")
        String number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
        SharedPreferences prefs = context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE);
        String previous = prefs.getString(KEY_STATE, TelephonyManager.EXTRA_STATE_IDLE);
        JSONObject message = new JSONObject();
        try {
            message.put("device", config.device);
            if (TelephonyManager.EXTRA_STATE_RINGING.equals(state)) {
                boolean canSeeNumbers = context.checkSelfPermission(Manifest.permission.READ_CALL_LOG)
                    == PackageManager.PERMISSION_GRANTED;
                // Android sends RINGING twice when it can share the number: once
                // without it, then with it. Wait for the one with the number.
                if (number == null && canSeeNumbers) return;
                long sentAt = prefs.getLong(KEY_SENT, 0);
                if (TelephonyManager.EXTRA_STATE_RINGING.equals(previous)
                    && System.currentTimeMillis() - sentAt < 60_000) return;
                String name = number == null ? null : contactName(context, number);
                String callId = java.util.UUID.randomUUID().toString();
                prefs.edit()
                    .putString(KEY_CALL, callId)
                    .putString(KEY_STATE, state)
                    .putString(KEY_NUMBER, number == null ? "" : number)
                    .putString(KEY_NAME, name == null ? "" : name)
                    .putLong(KEY_SENT, System.currentTimeMillis())
                    .apply();
                message.put("type", "ring").put("call", callId)
                    .put("number", number == null ? "" : number).put("name", name == null ? "" : name);
                announceWhileRinging(context, config, message, callId);
                return;
            } else if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {
                prefs.edit().putString(KEY_STATE, state).apply();
                if (!TelephonyManager.EXTRA_STATE_RINGING.equals(previous)) return; // an outgoing call
                message.put("type", "answered").put("call", prefs.getString(KEY_CALL, ""));
            } else if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {
                prefs.edit().putString(KEY_STATE, state).apply();
                CallControl.unmute(context);
                if (TelephonyManager.EXTRA_STATE_IDLE.equals(previous)) return;
                message.put("type", "ended").put("call", prefs.getString(KEY_CALL, ""))
                    .put("missed", TelephonyManager.EXTRA_STATE_RINGING.equals(previous))
                    .put("number", prefs.getString(KEY_NUMBER, ""))
                    .put("name", prefs.getString(KEY_NAME, ""));
            } else {
                return;
            }
        } catch (Exception e) {
            return;
        }
        PendingResult pending = goAsync();
        ConnectSender.send(config, message, ok -> pending.finish());
    }

    /**
     * Sends the ring now and again every few seconds while this same call is
     * still ringing (up to 45 s), holding the CPU awake meanwhile. The main
     * phone rings once per call, so repeats only help one that was offline.
     */
    private void announceWhileRinging(Context context, ConnectConfig config, JSONObject message, String callId) {
        PendingResult pending = goAsync();
        android.os.PowerManager.WakeLock lock = context.getSystemService(android.os.PowerManager.class)
            .newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "lifeos:ring");
        lock.acquire(RESEND_FOR_MS + 10_000);
        new Thread(() -> {
            SharedPreferences prefs = context.getSharedPreferences(ConnectConfig.PREFS, Context.MODE_PRIVATE);
            long until = System.currentTimeMillis() + RESEND_FOR_MS;
            try {
                while (System.currentTimeMillis() < until) {
                    boolean stillRinging = callId.equals(prefs.getString(KEY_CALL, ""))
                        && TelephonyManager.EXTRA_STATE_RINGING.equals(prefs.getString(KEY_STATE, ""));
                    if (!stillRinging) break;
                    ConnectSender.sendNow(config, new JSONObject(message.toString()));
                    Thread.sleep(RESEND_EVERY_MS);
                }
            } catch (Exception ignored) {
                // Stop announcing.
            } finally {
                if (lock.isHeld()) lock.release();
                pending.finish();
            }
        }, "life-connect-ring").start();
    }

    private static String contactName(Context context, String number) {
        if (context.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return null;
        }
        Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number));
        try (Cursor cursor = context.getContentResolver().query(
            uri, new String[] { ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {
            // No name then.
        }
        return null;
    }
}
