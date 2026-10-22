package app.lifeos;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Keeps the last crash on the phone, so it can be copied from Settings and
 * sent on. Nothing leaves the phone by itself. Also reads Android's own record
 * of why the app last stopped (crash, freeze, killed for memory), which
 * catches freezes too.
 */
final class CrashLog {
    private static final String FILE = "last-crash.txt";
    private static final String NOTES = "app-notes.txt";
    private static final int MAX_NOTES = 30;
    private static final int MAX_TRACE = 6000;
    private static volatile boolean installed;

    private CrashLog() {}

    static void install(Context context) {
        if (installed) return;
        installed = true;
        File file = new File(context.getApplicationContext().getFilesDir(), FILE);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try (FileOutputStream out = new FileOutputStream(file)) {
                StringWriter trace = new StringWriter();
                error.printStackTrace(new PrintWriter(trace));
                String text = "Crashed " + new java.util.Date() + " on thread " + thread.getName()
                    + "\nAndroid " + Build.VERSION.RELEASE + ", " + Build.MANUFACTURER + " " + Build.MODEL
                    + "\n\n" + trim(trace.toString());
                out.write(text.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) {
                // Nothing more we can do while crashing.
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    /** Something the app recovered from (the page renderer dying), kept for the report. */
    static void note(Context context, String text) {
        append(context, new java.util.Date() + " — " + text);
    }

    /** A JavaScript error from the page. */
    static void webError(Context context, String text) {
        append(context, new java.util.Date() + " — page error: " + (text.length() > 400 ? text.substring(0, 400) : text));
    }

    private static synchronized void append(Context context, String line) {
        try {
            File file = new File(context.getApplicationContext().getFilesDir(), NOTES);
            java.util.List<String> lines = new java.util.ArrayList<>();
            if (file.exists()) lines.addAll(Files.readAllLines(file.toPath(), StandardCharsets.UTF_8));
            lines.add(line.replace('\n', ' '));
            while (lines.size() > MAX_NOTES) lines.remove(0);
            Files.write(file.toPath(), lines, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            // Not kept.
        }
    }

    /** The saved crash plus the last few exits Android recorded, as JSON. */
    static String report(Context context) {
        JSONObject report = new JSONObject();
        try {
            File file = new File(context.getFilesDir(), FILE);
            report.put("crash", file.exists() ? new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8) : "");
            File notes = new File(context.getFilesDir(), NOTES);
            report.put("notes", notes.exists() ? new String(Files.readAllBytes(notes.toPath()), StandardCharsets.UTF_8) : "");
            JSONArray exits = new JSONArray();
            if (Build.VERSION.SDK_INT >= 30) {
                ActivityManager manager = context.getSystemService(ActivityManager.class);
                boolean traced = false;
                for (ApplicationExitInfo exit : manager.getHistoricalProcessExitReasons(null, 0, 6)) {
                    String reason = reasonName(exit.getReason());
                    if (reason == null) continue; // ordinary exits
                    JSONObject item = new JSONObject()
                        .put("at", exit.getTimestamp())
                        .put("reason", reason)
                        .put("description", exit.getDescription() == null ? "" : exit.getDescription());
                    // The freeze trace says what was stuck; the newest one is enough.
                    if (!traced && exit.getReason() == ApplicationExitInfo.REASON_ANR) {
                        try (InputStream in = exit.getTraceInputStream()) {
                            if (in != null) item.put("trace", trim(readMain(in)));
                        } catch (Exception ignored) {
                            // No trace kept.
                        }
                        traced = true;
                    }
                    exits.put(item);
                }
            }
            report.put("exits", exits);
            report.put("device", Build.MANUFACTURER + " " + Build.MODEL + ", Android " + Build.VERSION.RELEASE);
        } catch (Exception ignored) {
            // Whatever was gathered.
        }
        return report.toString();
    }

    static void clear(Context context) {
        new File(context.getFilesDir(), FILE).delete();
        new File(context.getFilesDir(), NOTES).delete();
    }

    private static String reasonName(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_CRASH: return "crash";
            case ApplicationExitInfo.REASON_CRASH_NATIVE: return "native crash";
            case ApplicationExitInfo.REASON_ANR: return "froze (not responding)";
            case ApplicationExitInfo.REASON_LOW_MEMORY: return "closed for memory";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: return "closed for battery use";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: return "failed to start";
            case ApplicationExitInfo.REASON_SIGNALED: return "stopped by the system";
            case ApplicationExitInfo.REASON_DEPENDENCY_DIED: return "a part it needs stopped (e.g. WebView)";
            case ApplicationExitInfo.REASON_OTHER: return "stopped (other)";
            case ApplicationExitInfo.REASON_UNKNOWN: return "stopped (unknown)";
            case ApplicationExitInfo.REASON_FREEZER: return "frozen in the background";
            default: return null;
        }
    }

    /** From an ANR dump, just the part about the main thread and ours. */
    private static String readMain(InputStream in) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0 && bytes.size() < 400_000) bytes.write(buffer, 0, read);
        String dump = bytes.toString("UTF-8");
        StringBuilder kept = new StringBuilder();
        for (String block : dump.split("\n\n")) {
            if (block.startsWith("\"main\"") || block.contains("app.lifeos")) kept.append(block).append("\n\n");
        }
        return kept.length() > 0 ? kept.toString() : dump;
    }

    private static String trim(String text) {
        return text.length() > MAX_TRACE ? text.substring(0, MAX_TRACE) + "\n…" : text;
    }
}
