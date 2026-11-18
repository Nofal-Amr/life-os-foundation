package app.lifeos;

/** The other phone counts as online while any of its connections is on the channel. */
public class PeerPresenceTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        check(PeerPresence.peerOf("main").equals("sim"), "main's peer is the SIM phone");
        check(PeerPresence.peerOf("sim").equals("main"), "SIM phone's peer is main");

        PeerPresence p = new PeerPresence();
        check(!p.online("sim"), "nobody at first");
        p.join("sim", "a");
        check(p.online("sim"), "SIM phone joined");
        check(!p.online("main"), "other key untouched");

        p.join("sim", "b");
        p.leave("sim", "a");
        check(p.online("sim"), "reconnect overlap: still online");
        p.leave("sim", "b");
        check(!p.online("sim"), "last connection left: offline");

        p.leave("sim", "zzz");
        check(!p.online("sim"), "unknown leave is harmless");

        p.join("sim", "c");
        p.reset();
        check(!p.online("sim"), "reset forgets");
        System.out.println("PeerPresence: all passed");
    }
}
