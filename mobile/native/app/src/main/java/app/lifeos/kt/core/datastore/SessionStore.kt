package app.lifeos.kt.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.SharedPreferencesMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.lifeos.kt.core.common.ApplicationScope
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking

/** A signed-in session. [expiresAt] is in epoch seconds. */
data class Session(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val userId: String,
    val email: String?,
)

sealed interface SessionState {
    /** The phone's store is still opening (a few milliseconds; the splash covers it). */
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val session: Session) : SessionState
}

// 0.1 kept these in SharedPreferences; the migration moves them over, so nobody signs in again.
private val Context.sessionStore: DataStore<Preferences> by preferencesDataStore(
    name = "session_store",
    produceMigrations = { context -> listOf(SharedPreferencesMigration(context, "session")) },
)

/**
 * The session, kept on the phone. Being offline never signs you out: only the
 * server refusing the refresh token does, or you choosing to.
 */
@Singleton
class SessionStore @Inject constructor(
    @ApplicationContext context: Context,
    @ApplicationScope scope: CoroutineScope,
) : SessionSource {
    private val store = context.sessionStore

    val state: StateFlow<SessionState> = store.data
        .map { prefs -> prefs.toSession()?.let(SessionState::SignedIn) ?: SessionState.SignedOut }
        .stateIn(scope, SharingStarted.Eagerly, SessionState.Loading)

    /** The current session for OkHttp's threads; waits for the store the first time. */
    override fun current(): Session? = when (val now = state.value) {
        is SessionState.SignedIn -> now.session
        SessionState.SignedOut -> null
        SessionState.Loading -> runBlocking { store.data.first().toSession() }
    }

    override suspend fun save(session: Session) {
        store.edit {
            it[ACCESS] = session.accessToken
            it[REFRESH] = session.refreshToken
            it[EXPIRES_AT] = session.expiresAt
            it[USER_ID] = session.userId
            if (session.email != null) it[EMAIL] = session.email else it.remove(EMAIL)
        }
    }

    override suspend fun clear() {
        store.edit { it.clear() }
    }

    private fun Preferences.toSession(): Session? {
        return Session(
            accessToken = this[ACCESS] ?: return null,
            refreshToken = this[REFRESH] ?: return null,
            expiresAt = this[EXPIRES_AT] ?: 0,
            userId = this[USER_ID] ?: return null,
            email = this[EMAIL],
        )
    }

    private companion object {
        val ACCESS = stringPreferencesKey("access")
        val REFRESH = stringPreferencesKey("refresh")
        val EXPIRES_AT = longPreferencesKey("expiresAt")
        val USER_ID = stringPreferencesKey("userId")
        val EMAIL = stringPreferencesKey("email")
    }
}
