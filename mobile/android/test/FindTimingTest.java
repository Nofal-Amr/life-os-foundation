package app.lifeos;

/** Find my phone: when the torch is on, when it stops, and whether the alarm volume goes back. */
public class FindTimingTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        // About 2 flashes a second: on for the first half of each 500 ms.
        check(FindTiming.torchOn(0), "on at the start");
        check(FindTiming.torchOn(249), "still on just before half way");
        check(!FindTiming.torchOn(250), "off at half way");
        check(!FindTiming.torchOn(499), "off at the end of the cycle");
        check(FindTiming.torchOn(500), "on again for the next cycle");
        check(FindTiming.torchOn(10_100), "on later on");
        check(!FindTiming.torchOn(-1), "off before it started");
        int flips = 0;
        boolean last = false;
        for (long t = 0; t < 1000; t += FindTiming.TICK_MS) {
            boolean on = FindTiming.torchOn(t);
            if (on && !last) flips++;
            last = on;
        }
        check(flips == 2, "two flashes in one second, got " + flips);

        // Stops on its own after a minute.
        check(!FindTiming.timedOut(59_999), "still going before a minute");
        check(FindTiming.timedOut(FindTiming.DURATION_MS), "stops at a minute");
        check(FindTiming.DURATION_MS == 60_000, "a minute long");

        // The screen turning on stops it, but not in the first moments, when
        // the notification itself may light the screen.
        check(!FindTiming.screenStops(500), "the notification lighting the screen");
        check(FindTiming.screenStops(FindTiming.SCREEN_GRACE_MS), "someone picked it up");

        // The alarm volume goes back to what it was, unless the person changed it meanwhile.
        check(FindTiming.restoreTo(3, 7, 7) == 3, "back to 3 after raising to 7");
        check(FindTiming.restoreTo(3, 7, 5) == -1, "changed during the find: left alone");
        check(FindTiming.restoreTo(7, 7, 7) == -1, "already at max: nothing to do");
        check(FindTiming.restoreTo(-1, 7, 7) == -1, "never raised: nothing to do");

        // At least one of ring or flash.
        check(FindTiming.anything(true, false), "ring only");
        check(FindTiming.anything(false, true), "flash only");
        check(!FindTiming.anything(false, false), "neither");
        System.out.println("FindTiming: all passed");
    }
}
