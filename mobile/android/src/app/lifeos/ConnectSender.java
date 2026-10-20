package app.lifeos;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Sends one sealed Life Connect message through Supabase Realtime's broadcast endpoint. */
final class ConnectSender {
    private static final ExecutorService POOL = Executors.newCachedThreadPool();

    private ConnectSender() {}

    /**
     * Sends in the background; done (may be null) runs afterwards with whether
     * it went. Never blocks the caller, so it's safe from a broadcast receiver.
     */
    static void send(ConnectConfig config, JSONObject message, Callback done) {
        POOL.execute(() -> {
            boolean ok = false;
            try {
                ok = sendNow(config, message);
            } catch (Exception ignored) {
                // Reported as not sent.
            }
            if (done != null) {
                try {
                    done.finished(ok);
                } catch (Exception ignored) {
                    // A failing callback must not take the app down.
                }
            }
        });
    }

    /** Runs work on the sender's threads (for the SIM phone's repeated ring). */
    static void run(Runnable work) {
        POOL.execute(work);
    }

    interface Callback {
        void finished(boolean ok);
    }

    /** Sends, trying again twice if the network hiccups. */
    static boolean sendNow(ConnectConfig config, JSONObject message) {
        for (int attempt = 0; attempt < 3; attempt++) {
            if (sendOnce(config, message)) return true;
            try {
                Thread.sleep(1500L * (attempt + 1));
            } catch (InterruptedException e) {
                return false;
            }
        }
        return false;
    }

    private static boolean sendOnce(ConnectConfig config, JSONObject message) {
        HttpURLConnection connection = null;
        try {
            message.put("at", System.currentTimeMillis());
            // A one-off id, so a copied message can't be played back.
            message.put("n", java.util.UUID.randomUUID().toString());
            JSONObject payload = new JSONObject().put("d", config.seal(message));
            JSONObject item = new JSONObject()
                .put("topic", config.topic())
                .put("event", "lc")
                .put("payload", payload);
            byte[] body = new JSONObject().put("messages", new JSONArray().put(item)).toString()
                .getBytes(StandardCharsets.UTF_8);

            connection = (HttpURLConnection) new URL(config.url + "/realtime/v1/api/broadcast").openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", config.anonKey);
            connection.setRequestProperty("Authorization", "Bearer " + config.anonKey);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body);
            }
            int status = connection.getResponseCode();
            if (status >= 300) Log.w("LifeOS", "Life Connect send failed: " + status);
            return status < 300;
        } catch (Exception e) {
            Log.w("LifeOS", "Life Connect send failed: " + e.getClass().getSimpleName());
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
