package app.lifeos;

/**
 * When the SIM phone's battery is worth telling the main phone about, and
 * when the main phone should say it's running low. Plain Java (no Android
 * classes), so it is tested in mobile/android/test.
 */
final class BatteryRules {
    /** Low-battery alerts, lowest last: one each per discharge. */
    static final int[] LOW = {20, 10};
    /** Above this (or charging) the alerts are ready to fire again. */
    static final int REARM = 25;
    /** "No alert sent yet" for the current discharge. */
    static final int NONE = 101;

    private BatteryRules() {}

    /** Send when the percentage or charging changes; nothing for the same reading again. */
    static boolean worthSending(int lastLevel, boolean lastCharging, int level, boolean charging) {
        if (level < 0 || level > 100) return false;
        return level != lastLevel || charging != lastCharging;
    }

    /**
     * The alert to show now (20 or 10), or 0 for none. lastAlerted is the lowest
     * threshold already alerted in this discharge (NONE if none).
     */
    static int alertFor(int level, boolean charging, int lastAlerted) {
        if (charging || level < 0) return 0;
        int alert = 0;
        for (int threshold : LOW) {
            if (level <= threshold && lastAlerted > threshold) alert = threshold;
        }
        return alert;
    }

    /** What to remember after this reading: reset when charging or back above REARM. */
    static int nextLastAlerted(int level, boolean charging, int lastAlerted) {
        if (charging || level > REARM) return NONE;
        int alert = alertFor(level, charging, lastAlerted);
        return alert == 0 ? lastAlerted : alert;
    }
}
