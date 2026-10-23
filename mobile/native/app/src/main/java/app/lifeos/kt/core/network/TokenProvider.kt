package app.lifeos.kt.core.network

import app.lifeos.kt.core.datastore.Session
import app.lifeos.kt.core.datastore.SessionSource
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.HttpException

/**
 * Hands OkHttp a token the server accepts: refreshed shortly before it
 * expires, or once after a 401. A refused refresh signs out; a failed
 * connection doesn't (the next try refreshes).
 */
@Singleton
class TokenProvider @Inject constructor(
    private val session: SessionSource,
    private val auth: AuthApi,
) {
    private val lock = Any()

    /** The session just refreshed here, used until the stored one catches up. */
    @Volatile private var refreshed: Session? = null

    private fun currentSession(): Session? {
        val stored = session.current() ?: return null
        val recent = refreshed
        return if (recent != null && recent.userId == stored.userId && recent.expiresAt > stored.expiresAt) recent else stored
    }

    /** Called on OkHttp's threads. Null when signed out. */
    fun token(rejected: String? = null): String? = synchronized(lock) {
        val current = currentSession() ?: return null
        // Another call already refreshed past the token that was turned down.
        if (rejected != null && current.accessToken != rejected) return current.accessToken
        if (rejected == null && current.expiresAt - 60 > System.currentTimeMillis() / 1000) return current.accessToken
        val response = try {
            runBlocking { auth.token("refresh_token", buildJsonObject { put("refresh_token", JsonPrimitive(current.refreshToken)) }) }
        } catch (e: HttpException) {
            if (e.code() == 400 || e.code() == 401) {
                runBlocking { session.clear() }
                refreshed = null
                return null
            }
            throw java.io.IOException("Token refresh failed (${e.code()})", e)
        }
        val next = response.toSession()
        runBlocking { session.save(next) }
        refreshed = next
        next.accessToken
    }
}

/** Adds Supabase's key and the bearer token to every request. */
class SupabaseInterceptor(private val key: String, private val tokens: TokenProvider?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokens?.token() ?: key
        return chain.proceed(
            chain.request().newBuilder()
                .header("apikey", key)
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build(),
        )
    }
}

/** On a 401, refresh once and try again. */
class SupabaseAuthenticator(private val tokens: TokenProvider) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.priorResponse != null) return null
        val rejected = response.request.header("Authorization")?.removePrefix("Bearer ")
        val token = tokens.token(rejected = rejected) ?: return null
        return response.request.newBuilder().header("Authorization", "Bearer $token").build()
    }
}
