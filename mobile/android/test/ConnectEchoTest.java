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
        check(ConnectEcho.senderRole("sim", "+201001234567").equals("sim"), "role comes from \"by\"");
        check(ConnectEcho.senderRole("", "+201001234567").isEmpty(), "an SMS number is never a role");
        check(ConnectEcho.senderRole("", "Wafarha").isEmpty(), "a sender name is never a role");
        check(ConnectEcho.senderRole("", "main").equals("main"), "older app: role in \"from\"");
        check(ConnectEcho.senderRole(null, null).isEmpty(), "nothing at all: no role");
        check(!ConnectEcho.isOwn(ConnectEcho.senderRole("sim", "+201001234567"), "main"),
            "an SMS from the SIM phone shows on the main phone");
        System.out.println("ConnectEcho ok");
    }
}
