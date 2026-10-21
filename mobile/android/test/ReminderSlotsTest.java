package app.lifeos;

/** Reminders for the same thing share one notification, so they can't pile up. */
public class ReminderSlotsTest {
    private static void same(String expected, String actual) {
        if (!expected.equals(actual)) throw new AssertionError("expected " + expected + " but got " + actual);
    }

    public static void main(String[] args) {
        // A prayer's three reminders replace each other.
        same("2026-10-21-asr", ReminderSlots.slot("2026-10-21-asr"));
        same("2026-10-21-asr", ReminderSlots.slot("2026-10-21-asr-now"));
        same("2026-10-21-asr", ReminderSlots.slot("2026-10-21-asr-clutch"));
        // One water reminder at a time; one per task; one daily digest.
        same("water", ReminderSlots.slot("water-2026-10-21-600"));
        same("water", ReminderSlots.slot("water-2026-10-22-720"));
        same("task-3f2a-b1", ReminderSlots.slot("task-3f2a-b1-1729500000000"));
        same("tasks-digest", ReminderSlots.slot("tasks-2026-10-21"));
        same("azkar-morning", ReminderSlots.slot("2026-10-21-azkar-morning"));
        same("reminder", ReminderSlots.slot(null));
        // Water and tasks clear themselves; prayers stay until replaced.
        if (ReminderSlots.lifetime("water") <= 0) throw new AssertionError("water should expire");
        if (ReminderSlots.lifetime("task-x") <= 0) throw new AssertionError("tasks should expire");
        if (ReminderSlots.lifetime("2026-10-21-asr") != 0) throw new AssertionError("prayers stay");
        System.out.println("ReminderSlots: all passed");
    }
}
