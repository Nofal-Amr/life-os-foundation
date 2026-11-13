package app.lifeos;

/**
 * Checks for a wake-up alarm set in the phone's own Clock app (e.g. "Wake-up
 * for Fajr", 10 minutes before). Plain Java so it can be tested off the phone.
 */
public final class WakeAlarm {
    private WakeAlarm() {}

    /** Longest label passed to the Clock app. */
    public static final int MAX_LABEL = 60;

    /** A real time of day. */
    public static boolean validTime(int hour, int minute) {
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }

    /** The label as the Clock app gets it: trimmed, single line, not too long. */
    public static String label(String raw) {
        if (raw == null) return "Life OS";
        String clean = raw.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (clean.isEmpty()) return "Life OS";
        return clean.length() > MAX_LABEL ? clean.substring(0, MAX_LABEL) : clean;
    }
}
