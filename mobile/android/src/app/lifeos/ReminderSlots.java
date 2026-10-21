package app.lifeos;

/**
 * Which notification a reminder shares, and how long it stays (plain Java, so
 * it's tested without a phone). Used by NotificationTidy and ReminderReceiver.
 */
final class ReminderSlots {
    private static final long HOUR = 60 * 60_000L;

    private ReminderSlots() {}

    /**
     * The notification a reminder uses, from its id: "2026-10-21-asr-now" and
     * "2026-10-21-asr-clutch" share "2026-10-21-asr"; every water reminder is "water".
     */
    static String slot(String id) {
        if (id == null || id.isEmpty()) return "reminder";
        if (id.startsWith("water-")) return "water";
        if (id.startsWith("tasks-")) return "tasks-digest";
        if (id.startsWith("task-")) {
            // task-<uuid>-<at>: one per task.
            int cut = id.lastIndexOf('-');
            return cut > "task-".length() ? id.substring(0, cut) : id;
        }
        int azkar = id.indexOf("-azkar-");
        if (azkar > 0) return "azkar" + id.substring(azkar + "-azkar".length());
        if (id.endsWith("-now")) return id.substring(0, id.length() - "-now".length());
        if (id.endsWith("-clutch")) return id.substring(0, id.length() - "-clutch".length());
        return id;
    }

    /** How long a reminder stays before it clears itself; 0 = until dismissed or replaced. */
    static long lifetime(String slot) {
        if ("water".equals(slot)) return 2 * HOUR;
        if (slot.startsWith("task") || slot.startsWith("class-")) return 12 * HOUR;
        if (slot.startsWith("azkar")) return 6 * HOUR;
        return 0;
    }
}
