package app.lifeos;

/**
 * Life Connect messages go out through the relay's broadcast endpoint, and the
 * relay hands each one to every phone listening, the sender included. Each
 * message carries the sender's role ("main" or "sim"), so a phone can tell its
 * own message coming back and leave it alone (pressing Find on the main phone
 * must not ring the main phone too).
 */
final class ConnectEcho {
    private ConnectEcho() {}

    /** Whether a message from `from` is this phone's own, coming back. */
    static boolean isOwn(String from, String role) {
        return from != null && !from.isEmpty() && from.equals(role);
    }
}
