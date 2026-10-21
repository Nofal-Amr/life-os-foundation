package app.lifeos;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * The main phone's record of what Life Connect passed on: SMS from the SIM
 * phone, replies sent, and calls with how they ended. Kept in a file on this
 * phone only (it can hold one-time codes), newest last, trimmed to the last
 * 60 days and 400 entries. Life OS shows it on the Messages page.
 */
final class ConnectLog {
    private static final String FILE = "connect-log.json";
    private static final int MAX = 400;
    private static final long KEEP_MS = 60L * 24 * 60 * 60_000;

    private ConnectLog() {}

    /** An SMS that came in on the SIM phone. */
    static void sms(Context context, JSONObject message) {
        try {
            add(context, entry("sms", message.optLong("smsAt", System.currentTimeMillis()))
                .put("number", message.optString("from"))
                .put("name", message.optString("name"))
                .put("body", message.optString("body"))
                .put("device", message.optString("device")));
        } catch (Exception ignored) {
            // Not logged.
        }
    }

    /** A reply sent through the SIM phone (sent = it reached the SIM phone). */
    static void sent(Context context, String to, String who, String body, boolean sent) {
        try {
            add(context, entry("sent", System.currentTimeMillis())
                .put("number", to).put("name", who == null || who.equals(to) ? "" : who)
                .put("body", body).put("ok", sent));
        } catch (Exception ignored) {
            // Not logged.
        }
    }

    /** A call started ringing; later calls() updates how it ended. */
    static void call(Context context, JSONObject message) {
        try {
            add(context, entry("call", System.currentTimeMillis())
                .put("call", message.optString("call"))
                .put("number", message.optString("number"))
                .put("name", message.optString("name"))
                .put("device", message.optString("device"))
                .put("outcome", "ringing"));
        } catch (Exception ignored) {
            // Not logged.
        }
    }

    /** "answered", "missed" or "ended" (declined or hung up before answering). */
    static synchronized void callOutcome(Context context, String callId, String outcome) {
        if (callId == null || callId.isEmpty()) return;
        try {
            JSONArray all = load(context);
            for (int i = all.length() - 1; i >= 0; i--) {
                JSONObject item = all.getJSONObject(i);
                if (!"call".equals(item.optString("kind")) || !callId.equals(item.optString("call"))) continue;
                String current = item.optString("outcome");
                // "answered" stays answered when the call later ends.
                if ("answered".equals(current) && "ended".equals(outcome)) return;
                item.put("outcome", outcome);
                save(context, all);
                return;
            }
        } catch (Exception ignored) {
            // Left as it was.
        }
    }

    static synchronized String read(Context context) {
        return load(context).toString();
    }

    static synchronized void clear(Context context) {
        new File(context.getFilesDir(), FILE).delete();
    }

    private static JSONObject entry(String kind, long at) {
        try {
            return new JSONObject().put("kind", kind).put("at", at);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private static synchronized void add(Context context, JSONObject item) {
        try {
            JSONArray all = load(context);
            all.put(item);
            long oldest = System.currentTimeMillis() - KEEP_MS;
            JSONArray kept = new JSONArray();
            int start = Math.max(0, all.length() - MAX);
            for (int i = start; i < all.length(); i++) {
                JSONObject entry = all.getJSONObject(i);
                if (entry.optLong("at") >= oldest) kept.put(entry);
            }
            save(context, kept);
        } catch (Exception ignored) {
            // Not logged.
        }
    }

    private static JSONArray load(Context context) {
        try {
            File file = new File(context.getFilesDir(), FILE);
            if (!file.exists()) return new JSONArray();
            return new JSONArray(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context context, JSONArray all) throws Exception {
        File file = new File(context.getFilesDir(), FILE);
        File temp = new File(context.getFilesDir(), FILE + ".tmp");
        Files.write(temp.toPath(), all.toString().getBytes(StandardCharsets.UTF_8));
        if (!temp.renameTo(file)) {
            Files.write(file.toPath(), all.toString().getBytes(StandardCharsets.UTF_8));
            temp.delete();
        }
    }
}
