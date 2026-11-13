package app.lifeos;

/**
 * Sign-in results come back to the app through lifeos://auth-callback. Any web
 * page or app can open that link, so on its own it would let a stranger sign
 * this phone in to *their* account (and receive what you log next). The app
 * only accepts a sign-in result shortly after it sent you off to sign in, and
 * only once.
 *
 * Plain Java (no Android classes), so it is tested in mobile/android/test.
 */
final class AuthCallbackGate {
    /** How long a sign-in in the browser may take. */
    static final long WINDOW_MS = 30L * 60 * 1000;

    private AuthCallbackGate() {}

    /**
     * Whether leaving the app for this address starts a sign-in: Supabase's
     * Google redirect (/auth/v1/authorize) or the website's sign-in page opened
     * for the app (/auth?handoff=android).
     */
    static boolean startsSignIn(String path, String handoff) {
        if (path == null) return false;
        if (path.endsWith("/auth/v1/authorize")) return true;
        return ("/auth".equals(path) || "/auth/".equals(path)) && "android".equals(handoff);
    }

    /** Whether a callback arriving at now belongs to the sign-in started at startedAt (0: none). */
    static boolean accepts(long startedAt, long now) {
        return startedAt > 0 && now >= startedAt && now - startedAt <= WINDOW_MS;
    }
}
