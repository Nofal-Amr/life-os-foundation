package app.lifeos;

/**
 * Life Connect messages go out through the relay's broadcast endpoint, and the
 * relay hands each one to every phone listening, the sender included. Each
 * message carries the sender's role ("main" or "sim") in its own field, "by",
 * so a phone can tell its own message coming back and leave it alone (pressing
 * Find on the main phone must not ring the main phone too).
 *
 * The role used to go in "from", which an SMS also uses for the number it came
 * from: every forwarded SMS then showed as from "sim" and replies went nowhere.
 */
final class ConnectEcho {
    /** The field that names the sending phone's role. */
    static final String FIELD = "by";

    private ConnectEcho() {}

    /**
     * The sending phone's role: "by", or for apps from before it, "from" when it
     * holds a role (an SMS's "from" is a phone number or a name, never a role).
     */
    static String senderRole(String by, String from) {
        if (by != null && !by.isEmpty()) return by;
        if ("main".equals(from) || "sim".equals(from)) return from;
        return "";
    }

    /** Whether a message from `from` is this phone's own, coming back. */
    static boolean isOwn(String from, String role) {
        return from != null && !from.isEmpty() && from.equals(role);
    }
}
