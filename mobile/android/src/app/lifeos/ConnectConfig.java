package app.lifeos;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Life Connect settings for this phone, handed over by the web app: its role
 * ("sim" sends calls, "main" rings), the account's shared secret, and the
 * Supabase project to relay through.
 *
 * Everything that crosses the relay is sealed with AES-GCM under a key
 * derived from the secret, and the channel name is derived from it too, so
 * only phones signed in to the same account can read or even find it.
 */
final class ConnectConfig {
    static final String PREFS = "connect";
    private static final String KEY_JSON = "config";
    /** Messages older than this are ignored (replays, or a phone that slept through them). */
    static final long MAX_AGE_MS = 90_000;

    final String role;
    final String url;
    final String anonKey;
    final String device;
    private final String secret;

    private ConnectConfig(String role, String secret, String url, String anonKey, String device) {
        this.role = role;
        this.secret = secret;
        this.url = url;
        this.anonKey = anonKey;
        this.device = device;
    }

    /** Stores what the web app sent; returns false if it isn't usable. */
    static boolean save(Context context, String json) {
        try {
            JSONObject value = new JSONObject(json);
            String role = value.optString("role", "off");
            if (!role.matches("off|sim|main")) return false;
            if (!"off".equals(role)) {
                if (!value.optString("secret").matches("[0-9a-f]{64}")) return false;
                if (!value.optString("url").startsWith("https://")) return false;
                if (value.optString("anonKey").isEmpty()) return false;
            }
            prefs(context).edit().putString(KEY_JSON, value.toString()).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** The saved settings, or null when Life Connect is off on this phone. */
    static ConnectConfig load(Context context) {
        try {
            JSONObject value = new JSONObject(prefs(context).getString(KEY_JSON, "{}"));
            String role = value.optString("role", "off");
            if (!"sim".equals(role) && !"main".equals(role)) return null;
            return new ConnectConfig(
                role,
                value.getString("secret"),
                value.getString("url").replaceAll("/+$", ""),
                value.getString("anonKey"),
                value.optString("device", "SIM phone"));
        } catch (Exception e) {
            return null;
        }
    }

    static String roleOf(Context context) {
        ConnectConfig config = load(context);
        return config == null ? "off" : config.role;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The relay channel: derived from the secret, so it can't be guessed. */
    String topic() {
        return "lifeconnect-" + hex(sha256("topic:" + secret)).substring(0, 40);
    }

    private byte[] aesKey() {
        return sha256("key:" + secret);
    }

    /** Seals a message: base64(iv | ciphertext+tag). */
    String seal(JSONObject message) throws Exception {
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(aesKey(), "AES"), new GCMParameterSpec(128, iv));
        byte[] body = cipher.doFinal(message.toString().getBytes(StandardCharsets.UTF_8));
        byte[] out = new byte[iv.length + body.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(body, 0, out, iv.length, body.length);
        return Base64.encodeToString(out, Base64.NO_WRAP);
    }

    /** Opens a sealed message; null if it isn't ours, was tampered with, or is stale. */
    JSONObject open(String sealed) {
        try {
            byte[] data = Base64.decode(sealed, Base64.NO_WRAP);
            if (data.length < 13 + 16) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey(), "AES"), new GCMParameterSpec(128, data, 0, 12));
            byte[] plain = cipher.doFinal(data, 12, data.length - 12);
            JSONObject message = new JSONObject(new String(plain, StandardCharsets.UTF_8));
            long age = System.currentTimeMillis() - message.optLong("at", 0);
            if (age > MAX_AGE_MS || age < -MAX_AGE_MS) return null;
            return message;
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] sha256(String text) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        for (byte b : bytes) out.append(String.format("%02x", b));
        return out.toString();
    }
}
