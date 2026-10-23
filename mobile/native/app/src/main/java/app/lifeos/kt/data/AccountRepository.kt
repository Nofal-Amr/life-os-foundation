package app.lifeos.kt.data

import app.lifeos.kt.core.database.RowDao
import app.lifeos.kt.core.database.RowEntity
import app.lifeos.kt.core.datastore.SessionState
import kotlinx.serialization.json.jsonPrimitive
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.Session
import app.lifeos.kt.core.datastore.SessionStore
import app.lifeos.kt.core.network.AuthApi
import app.lifeos.kt.core.sync.SyncEngine
import app.lifeos.kt.core.vault.Vault
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/** Signing in and out. Another account's data never mixes with this one's. */
@Singleton
class AccountRepository @Inject constructor(
    private val auth: AuthApi,
    private val session: SessionStore,
    private val settings: AppSettings,
    private val rows: RowDao,
    private val sync: SyncEngine,
    private val vault: Vault,
) {
    val state = session.state

    /** Throws retrofit2.HttpException (400 = wrong email or password) or IOException (offline). */
    suspend fun signIn(email: String, password: String) {
        val body = buildJsonObject {
            put("email", JsonPrimitive(email))
            put("password", JsonPrimitive(password))
        }
        signedIn(auth.token("password", body).toSession())
    }

    /** A Google ID token from Android's account picker, checked by Supabase against [nonce]. */
    suspend fun signInWithGoogle(idToken: String, nonce: String) {
        val body = buildJsonObject {
            put("provider", JsonPrimitive("google"))
            put("id_token", JsonPrimitive(idToken))
            put("nonce", JsonPrimitive(nonce))
        }
        signedIn(auth.token("id_token", body).toSession())
    }

    suspend fun signedIn(fresh: Session) {
        val owner = settings.owner()
        if (owner != null && owner != fresh.userId) rows.clear()
        settings.setOwner(fresh.userId)
        session.save(fresh)
        sync.request()
    }

    /** Demo mode: the website's sample month, on this phone only. Leaving it (sign out) forgets it. */
    suspend fun startDemo() {
        rows.clear()
        for ((table, list) in DemoSeed.seed()) {
            rows.upsertAll(list.map { row -> RowEntity(table, row["id"]!!.jsonPrimitive.content, row.toString()) })
        }
        settings.setOwner(DemoSeed.USER)
        session.save(Session("demo", "demo", Long.MAX_VALUE / 2, DemoSeed.USER, null))
    }

    /** Back to the sample month as it was. */
    suspend fun resetDemo() = startDemo()

    val isDemo: Boolean get() = (session.state.value as? SessionState.SignedIn)?.session?.userId == DemoSeed.USER

    /** Signs out and forgets everything on this phone. */
    suspend fun signOut() {
        vault.lock()
        vault.disableFingerprint()
        session.clear()
        rows.clear()
        settings.clearAccountData()
    }
}
