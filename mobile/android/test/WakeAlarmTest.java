package app.lifeos;

/** Wake-up alarm: which times are accepted and what label the Clock app gets. */
public class WakeAlarmTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        check(WakeAlarm.validTime(0, 0), "midnight");
        check(WakeAlarm.validTime(4, 27), "before Fajr");
        check(WakeAlarm.validTime(23, 59), "last minute of the day");
        check(!WakeAlarm.validTime(24, 0), "no hour 24");
        check(!WakeAlarm.validTime(-1, 10), "no negative hour");
        check(!WakeAlarm.validTime(5, 60), "no minute 60");

        check(WakeAlarm.label("  Wake-up for Fajr ").equals("Wake-up for Fajr"), "trimmed");
        check(WakeAlarm.label("a\nb").equals("a b"), "one line");
        check(WakeAlarm.label(null).equals("Life OS"), "a default when missing");
        check(WakeAlarm.label("   ").equals("Life OS"), "a default when blank");
        check(WakeAlarm.label("x".repeat(100)).length() == WakeAlarm.MAX_LABEL, "kept short");
        System.out.println("WakeAlarmTest passed");
    }
}
