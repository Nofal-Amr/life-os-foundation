package app.lifeos;

import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * A small WebSocket client for Supabase Realtime (Phoenix protocol), enough
 * to join one broadcast channel and hear its messages. Reconnects on its own
 * with a growing pause, and straight away when kicked (network came back).
 */
final class RealtimeSocket {
    interface Listener {
        /** A broadcast's payload "d" field (a sealed Life Connect message). */
        void onMessage(String sealed);

        void onConnected(boolean connected);
    }

    private static final int MAX_FRAME = 1 << 20;
    private static final long HEARTBEAT_MS = 25_000;

    private final String host;
    private final String anonKey;
    private final String topic;
    private final Listener listener;
    private final SecureRandom random = new SecureRandom();
    private volatile boolean running;
    private volatile Socket socket;
    private Thread thread;
    private int ref = 0;

    RealtimeSocket(String url, String anonKey, String topic, Listener listener) {
        this.host = url.replaceFirst("^https://", "").replaceAll("/.*$", "");
        this.anonKey = anonKey;
        this.topic = topic;
        this.listener = listener;
    }

    synchronized void start() {
        if (running) return;
        running = true;
        thread = new Thread(this::loop, "life-connect");
        thread.setDaemon(true);
        thread.start();
    }

    synchronized void stop() {
        running = false;
        closeQuietly();
        if (thread != null) thread.interrupt();
    }

    /** Drop the current connection so the loop reconnects now (e.g. network back). */
    void kick() {
        closeQuietly();
        if (thread != null) thread.interrupt();
    }

    private void closeQuietly() {
        Socket current = socket;
        if (current != null) {
            try {
                current.close();
            } catch (IOException ignored) {
                // Already gone.
            }
        }
    }

    private void loop() {
        long pause = 2_000;
        while (running) {
            Thread heartbeat = null;
            try {
                SSLSocket ssl = (SSLSocket) SSLSocketFactory.getDefault().createSocket(host, 443);
                ssl.setSoTimeout((int) (HEARTBEAT_MS * 3));
                ssl.startHandshake();
                socket = ssl;
                InputStream in = ssl.getInputStream();
                OutputStream out = ssl.getOutputStream();
                handshake(in, out);
                send(out, join());
                listener.onConnected(true);
                pause = 2_000;
                heartbeat = startHeartbeat(out);
                read(new DataInputStream(in), out);
            } catch (Exception e) {
                if (running) Log.i("LifeOS", "Life Connect reconnecting: " + e.getClass().getSimpleName());
            } finally {
                if (heartbeat != null) heartbeat.interrupt();
                closeQuietly();
                socket = null;
                listener.onConnected(false);
            }
            if (!running) break;
            try {
                Thread.sleep(pause);
            } catch (InterruptedException ignored) {
                // Kicked: reconnect now.
                pause = 2_000;
                continue;
            }
            pause = Math.min(pause * 2, 60_000);
        }
    }

    private void handshake(InputStream in, OutputStream out) throws IOException {
        byte[] nonce = new byte[16];
        random.nextBytes(nonce);
        String key = Base64.encodeToString(nonce, Base64.NO_WRAP);
        String request = "GET /realtime/v1/websocket?apikey=" + anonKey + "&vsn=1.0.0 HTTP/1.1\r\n"
            + "Host: " + host + "\r\n"
            + "Upgrade: websocket\r\n"
            + "Connection: Upgrade\r\n"
            + "Sec-WebSocket-Key: " + key + "\r\n"
            + "Sec-WebSocket-Version: 13\r\n\r\n";
        out.write(request.getBytes(StandardCharsets.US_ASCII));
        out.flush();
        StringBuilder headers = new StringBuilder();
        int matched = 0;
        while (matched < 4) {
            int b = in.read();
            if (b < 0) throw new IOException("closed during handshake");
            headers.append((char) b);
            matched = (b == '\r' || b == '\n') ? matched + 1 : 0;
            if (headers.length() > 8192) throw new IOException("handshake too long");
        }
        if (!headers.toString().startsWith("HTTP/1.1 101")) throw new IOException("handshake refused");
    }

    private String join() throws Exception {
        JSONObject config = new JSONObject()
            .put("broadcast", new JSONObject().put("self", false).put("ack", false))
            .put("presence", new JSONObject().put("key", ""))
            .put("private", false);
        return new JSONObject()
            .put("topic", "realtime:" + topic)
            .put("event", "phx_join")
            .put("payload", new JSONObject().put("config", config).put("access_token", anonKey))
            .put("ref", String.valueOf(++ref))
            .toString();
    }

    private Thread startHeartbeat(OutputStream out) {
        Thread beat = new Thread(() -> {
            try {
                while (!Thread.currentThread().isInterrupted()) {
                    Thread.sleep(HEARTBEAT_MS);
                    send(out, new JSONObject()
                        .put("topic", "phoenix")
                        .put("event", "heartbeat")
                        .put("payload", new JSONObject())
                        .put("ref", String.valueOf(++ref))
                        .toString());
                }
            } catch (Exception ignored) {
                // Interrupted or the socket closed; the read loop reconnects.
            }
        }, "life-connect-heartbeat");
        beat.setDaemon(true);
        beat.start();
        return beat;
    }

    private void read(DataInputStream in, OutputStream out) throws Exception {
        ByteArrayOutputStream message = new ByteArrayOutputStream();
        while (running) {
            int b0 = in.readUnsignedByte();
            int b1 = in.readUnsignedByte();
            boolean fin = (b0 & 0x80) != 0;
            int opcode = b0 & 0x0F;
            long length = b1 & 0x7F;
            if (length == 126) length = in.readUnsignedShort();
            else if (length == 127) length = in.readLong();
            if (length < 0 || length > MAX_FRAME) throw new IOException("frame too large");
            byte[] mask = null;
            if ((b1 & 0x80) != 0) {
                mask = new byte[4];
                in.readFully(mask);
            }
            byte[] data = new byte[(int) length];
            in.readFully(data);
            if (mask != null) for (int i = 0; i < data.length; i++) data[i] ^= mask[i % 4];

            switch (opcode) {
                case 0x0: // continuation
                case 0x1: // text
                    message.write(data);
                    if (message.size() > MAX_FRAME) throw new IOException("message too large");
                    if (fin) {
                        handle(new String(message.toByteArray(), StandardCharsets.UTF_8));
                        message.reset();
                    }
                    break;
                case 0x8: // close
                    throw new IOException("closed by server");
                case 0x9: // ping
                    frame(out, 0xA, data);
                    break;
                default: // pong, binary: ignore
                    break;
            }
        }
    }

    private void handle(String text) {
        try {
            JSONObject message = new JSONObject(text);
            if (!"broadcast".equals(message.optString("event"))) return;
            if (!("realtime:" + topic).equals(message.optString("topic"))) return;
            JSONObject outer = message.optJSONObject("payload");
            JSONObject inner = outer == null ? null : outer.optJSONObject("payload");
            String sealed = inner == null ? null : inner.optString("d", null);
            if (sealed != null) listener.onMessage(sealed);
        } catch (Exception ignored) {
            // Not a message for us.
        }
    }

    private void send(OutputStream out, String text) throws IOException {
        frame(out, 0x1, text.getBytes(StandardCharsets.UTF_8));
    }

    /** Client frames must be masked. */
    private synchronized void frame(OutputStream out, int opcode, byte[] data) throws IOException {
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        frame.write(0x80 | opcode);
        if (data.length < 126) {
            frame.write(0x80 | data.length);
        } else if (data.length < 65536) {
            frame.write(0x80 | 126);
            frame.write(data.length >> 8);
            frame.write(data.length & 0xFF);
        } else {
            frame.write(0x80 | 127);
            for (int i = 7; i >= 0; i--) frame.write((int) ((long) data.length >> (8 * i)) & 0xFF);
        }
        byte[] mask = new byte[4];
        random.nextBytes(mask);
        frame.write(mask);
        for (int i = 0; i < data.length; i++) frame.write(data[i] ^ mask[i % 4]);
        out.write(frame.toByteArray());
        out.flush();
    }
}
