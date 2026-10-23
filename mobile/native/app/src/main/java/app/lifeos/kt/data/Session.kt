package app.lifeos.kt.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * The signed-in session, kept on the phone. Being offline never signs you
 * out: only the server refusing the refresh token does, or you choosing to.
 */
class SessionStore(context: Context, private val api: Supabase) {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val lock = Mutex()
    private val _current = MutableStateFlow(load())
    val current: StateFlow<SessionData?> = _current

    fun save(session: SessionData) {
        prefs.edit()
            .putString("access", session.accessToken)
            .putString("refresh", session.refreshToken)
            .putLong("expiresAt", session.expiresAt)
            .putString("userId", session.userId)
            .putString("email", session.email)
            .apply()
        _current.value = session
    }

    /** The server turned the token down early: refresh it on the next [token] call. */
    fun expire() {
        _current.value?.let { save(it.copy(expiresAt = 0)) }
    }

    fun clear() {
        prefs.edit().clear().apply()
        _current.value = null
    }

    /**
     * A token the server accepts, refreshed when it's about to expire; null
     * when signed out. Throws IOException when the refresh can't reach the server.
     */
    suspend fun token(): String? = lock.withLock {
        val session = _current.value ?: return null
        if (session.expiresAt - 60 > System.currentTimeMillis() / 1000) return session.accessToken
        val fresh = try {
            withContext(Dispatchers.IO) { api.refresh(session.refreshToken) }
        } catch (e: ServerError) {
            // Revoked or already used: sign-in is needed again. Anything else is the server's hiccup.
            if (e.code == 400 || e.code == 401) {
                clear()
                return null
            }
            throw e
        }
        save(fresh)
        fresh.accessToken
    }

    private fun load(): SessionData? {
        val access = prefs.getString("access", null) ?: return null
        return SessionData(
            accessToken = access,
            refreshToken = prefs.getString("refresh", null) ?: return null,
            expiresAt = prefs.getLong("expiresAt", 0),
            userId = prefs.getString("userId", null) ?: return null,
            email = prefs.getString("email", null),
        )
    }
}
