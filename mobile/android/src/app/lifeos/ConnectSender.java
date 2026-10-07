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
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();

    private ConnectSender() {}

    /** Sends in the background; done (may be null) runs afterwards with whether it went. */
    static void send(ConnectConfig config, JSONObject message, Callback done) {
        POOL.execute(() -> {
            boolean ok = sendNow(config, message);
            if (done != null) done.finished(ok);
        });
    }

    interface Callback {
        void finished(boolean ok);
    }

    static boolean sendNow(ConnectConfig config, JSONObject message) {
        HttpURLConnection connection = null;
        try {
            message.put("at", System.currentTimeMillis());
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
