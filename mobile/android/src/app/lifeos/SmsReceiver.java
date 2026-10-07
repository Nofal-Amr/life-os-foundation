package app.lifeos;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Life Connect on the SIM phone: each SMS that arrives is sent on to the main
 * phone (encrypted, never stored), unless you turned SMS forwarding off — or
 * it's a one-time code and you chose not to forward those.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final Pattern CODE = Pattern.compile(
        "(?i)\\b(otp|one[- ]?time|verification|passcode|password|code)\\b|رمز|كود|كلمة السر|كلمة المرور|التحقق");

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        ConnectConfig config = ConnectConfig.load(context);
        if (config == null || !"sim".equals(config.role) || !config.forwardSms) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;

        // A long SMS arrives in parts; join them per sender.
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        long at = System.currentTimeMillis();
        for (SmsMessage part : parts) {
            if (part == null) continue;
            String from = part.getDisplayOriginatingAddress();
            if (from == null) from = "";
            bySender.computeIfAbsent(from, key -> new StringBuilder()).append(part.getDisplayMessageBody());
            at = part.getTimestampMillis();
        }

        PendingResult pending = goAsync();
        long sentAt = at;
        new Thread(() -> {
            try {
                for (Map.Entry<String, StringBuilder> entry : bySender.entrySet()) {
                    String body = entry.getValue().toString();
                    if (!config.forwardCodes && CODE.matcher(body).find()) continue;
                    String from = entry.getKey();
                    String name = contactName(context, from);
                    ConnectSender.sendNow(config, new JSONObject()
                        .put("type", "sms")
                        .put("from", from)
                        .put("name", name == null ? "" : name)
                        .put("body", body.length() > 3000 ? body.substring(0, 3000) : body)
                        .put("smsAt", sentAt)
                        .put("device", config.device));
                }
            } catch (Exception ignored) {
                // Nothing more to do.
            } finally {
                pending.finish();
            }
        }).start();
    }

    static String contactName(Context context, String number) {
        if (number == null || number.isEmpty()) return null;
        if (context.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return null;
        }
        android.net.Uri uri = android.net.Uri.withAppendedPath(
            android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(number));
        try (android.database.Cursor cursor = context.getContentResolver().query(
            uri, new String[] { android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {
            // No name.
        }
        return null;
    }
}
