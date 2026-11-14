package app.lifeos.kt.core.auth

import android.content.Context

/**
 * Sign-in results come back through lifeosnative://auth-callback. Any web page or app can open
 * that link, so on its own it would let a stranger sign this phone in to *their* account (and
 * receive what you log next). The app accepts a sign-in result only shortly after it sent you to
 * the browser to sign in, and only once. Same rule as the web-view app's AuthCallbackGate.
 */
object CallbackGate {
    /** How long a sign-in in the browser may take. */
    const val WINDOW_MS = 30L * 60 * 1000

    /** Whether a callback arriving at [now] belongs to the sign-in started at [startedAt] (0: none). */
    fun accepts(startedAt: Long, now: Long): Boolean =
        startedAt > 0 && now >= startedAt && now - startedAt <= WINDOW_MS
}

/** Remembers that the app sent you to sign in, kept if Android closes the app meanwhile. */
class PendingSignIn(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun start(now: Long = System.currentTimeMillis()) {
        prefs.edit().putLong(KEY, now).apply()
    }

    /** True once for a callback within the window of a sign-in this app started. Clears it either way. */
    fun take(now: Long = System.currentTimeMillis()): Boolean {
        val startedAt = prefs.getLong(KEY, 0L)
        prefs.edit().remove(KEY).apply()
        return CallbackGate.accepts(startedAt, now)
    }

    private companion object {
        const val PREFS = "auth_gate"
        const val KEY = "signInStartedAt"
    }
}
