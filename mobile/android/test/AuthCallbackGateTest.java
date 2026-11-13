package app.lifeos;

/** A sign-in result is only taken right after the app started a sign-in. */
public class AuthCallbackGateTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        long start = 1_700_000_000_000L;
        // No sign-in started: a link from a web page or another app is ignored.
        check(!AuthCallbackGate.accepts(0, start), "no sign-in started");
        // Back from the browser within the window: taken.
        check(AuthCallbackGate.accepts(start, start + 60_000), "back after a minute");
        check(AuthCallbackGate.accepts(start, start + AuthCallbackGate.WINDOW_MS), "back at the edge");
        // Too late, or a clock that went backwards: ignored.
        check(!AuthCallbackGate.accepts(start, start + AuthCallbackGate.WINDOW_MS + 1), "too late");
        check(!AuthCallbackGate.accepts(start, start - 1), "before it started");

        // What counts as starting a sign-in.
        check(AuthCallbackGate.startsSignIn("/auth/v1/authorize", null), "Supabase Google redirect");
        check(AuthCallbackGate.startsSignIn("/auth", "android"), "website sign-in for the app");
        check(!AuthCallbackGate.startsSignIn("/auth", null), "plain website sign-in page");
        check(!AuthCallbackGate.startsSignIn("/privacy", "android"), "another page");
        check(!AuthCallbackGate.startsSignIn(null, "android"), "no path");
        System.out.println("AuthCallbackGate: all passed");
    }
}
