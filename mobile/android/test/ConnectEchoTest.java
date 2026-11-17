package app.lifeos;

/** Life Connect: a phone ignores its own messages that the relay sends back. */
public class ConnectEchoTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        check(ConnectEcho.isOwn("main", "main"), "the main phone's own Find comes back: ignore it");
        check(ConnectEcho.isOwn("sim", "sim"), "the SIM phone's own Find comes back: ignore it");
        check(!ConnectEcho.isOwn("sim", "main"), "Find from the SIM phone rings the main phone");
        check(!ConnectEcho.isOwn("main", "sim"), "Find from the main phone rings the SIM phone");
        check(!ConnectEcho.isOwn("", "main"), "an older app sends no role: act on it");
        check(!ConnectEcho.isOwn(null, "sim"), "no role at all: act on it");
        System.out.println("ConnectEcho ok");
    }
}
