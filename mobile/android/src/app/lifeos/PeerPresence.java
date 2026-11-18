package app.lifeos;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Who is on the Life Connect channel right now, from the relay's presence
 * messages. Each phone shows up under its role ("main" or "sim"); one phone
 * can briefly be there twice (a reconnect overlapping the old connection), so
 * each connection is counted by its ref and a phone is online while any remain.
 *
 * Presence costs nothing extra: the relay sees a phone leave when its
 * connection closes or stops answering heartbeats (about a minute).
 */
final class PeerPresence {
    private final Map<String, Set<String>> refs = new HashMap<>();

    /** The other phone's role. */
    static String peerOf(String role) {
        return "main".equals(role) ? "sim" : "main";
    }

    /** A full list is starting (just joined): forget what was known. */
    synchronized void reset() {
        refs.clear();
    }

    synchronized void join(String key, String ref) {
        if (key == null || key.isEmpty()) return;
        refs.computeIfAbsent(key, k -> new HashSet<>()).add(ref == null ? "" : ref);
    }

    synchronized void leave(String key, String ref) {
        Set<String> set = refs.get(key);
        if (set == null) return;
        set.remove(ref == null ? "" : ref);
        if (set.isEmpty()) refs.remove(key);
    }

    synchronized boolean online(String key) {
        Set<String> set = refs.get(key);
        return set != null && !set.isEmpty();
    }
}
