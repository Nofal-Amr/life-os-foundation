package app.lifeos;

/** Find my phone's timing and volume decisions, kept free of Android so they can be tested. */
final class FindTiming {
    /** How long a find lasts before it stops on its own. */
    static final long DURATION_MS = 60_000;
    /** One flash cycle: on for the first half, off for the second (about 2 Hz). */
    static final long FLASH_PERIOD_MS = 500;
    /** How often the torch is checked. */
    static final long TICK_MS = 125;
    /** The screen turning on this soon after the start is the notification, not a person. */
    static final long SCREEN_GRACE_MS = 3_000;

    private FindTiming() {}

    static boolean torchOn(long elapsedMs) {
        if (elapsedMs < 0) return false;
        return elapsedMs % FLASH_PERIOD_MS < FLASH_PERIOD_MS / 2;
    }

    static boolean timedOut(long elapsedMs) {
        return elapsedMs >= DURATION_MS;
    }

    static boolean screenStops(long elapsedMs) {
        return elapsedMs >= SCREEN_GRACE_MS;
    }

    /**
     * The alarm volume to put back when a find ends, or -1 to leave it.
     * original: before the find (-1 if it was never raised); raised: what the
     * find set; current: what it is now. If the person changed it meanwhile,
     * their choice stays.
     */
    static int restoreTo(int original, int raised, int current) {
        if (original < 0 || original == raised) return -1;
        if (current != raised) return -1;
        return original;
    }

    static boolean anything(boolean ring, boolean flash) {
        return ring || flash;
    }
}
