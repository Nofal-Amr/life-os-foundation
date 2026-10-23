package app.lifeos.kt.core.network

import app.lifeos.kt.core.datastore.Session
import java.util.Base64
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.QueryMap

/** Supabase Auth (GoTrue). */
interface AuthApi {
    @POST("auth/v1/token")
    suspend fun token(@Query("grant_type") grantType: String, @Body body: JsonObject): TokenResponse
}

/** Supabase's tables and functions (PostgREST). Row-level security limits every call to your own rows. */
interface RestApi {
    @GET("rest/v1/{table}")
    suspend fun select(@Path("table") table: String, @QueryMap query: Map<String, String>): JsonArray

    /** Inserts or updates, matching on [onConflict]; only the columns sent are written. */
    @POST("rest/v1/{table}")
    suspend fun upsert(
        @Path("table") table: String,
        @Query("on_conflict") onConflict: String,
        @Header("Prefer") prefer: String,
        @Body rows: JsonArray,
    ): Response<Unit>

    @DELETE("rest/v1/{table}")
    suspend fun delete(@Path("table") table: String, @Query("id") idFilter: String, @Header("Prefer") prefer: String): Response<Unit>

    @POST("rest/v1/rpc/{function}")
    suspend fun rpc(@Path("function") function: String, @Body args: JsonObject): JsonElement
}

@Serializable
data class TokenResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_at") val expiresAt: Long? = null,
    @SerialName("expires_in") val expiresIn: Long = 3600,
    val user: AuthUser,
) {
    fun toSession() = Session(
        accessToken = accessToken,
        refreshToken = refreshToken,
        expiresAt = expiresAt ?: (System.currentTimeMillis() / 1000 + expiresIn),
        userId = user.id,
        email = user.email,
    )
}

@Serializable
data class AuthUser(val id: String, val email: String? = null)

/**
 * The website's hand-back after Google sign-in:
 * lifeosnative://auth-callback#access_token=…&refresh_token=…&expires_in=… .
 * The user comes from the token's own claims.
 */
fun sessionFromCallbackFragment(fragment: String, json: Json = Json { ignoreUnknownKeys = true }): Session? {
    val params = fragment.split("&").mapNotNull { part ->
        val pair = part.split("=", limit = 2)
        if (pair.size == 2) pair[0] to java.net.URLDecoder.decode(pair[1], "UTF-8") else null
    }.toMap()
    val access = params["access_token"] ?: return null
    val refresh = params["refresh_token"] ?: return null
    val claims = runCatching {
        json.parseToJsonElement(String(Base64.getUrlDecoder().decode(access.split(".")[1]))).jsonObject
    }.getOrNull() ?: return null
    val userId = claims["sub"]?.jsonPrimitive?.content ?: return null
    val expiresAt = params["expires_at"]?.toLongOrNull()
        ?: params["expires_in"]?.toLongOrNull()?.let { System.currentTimeMillis() / 1000 + it }
        ?: claims["exp"]?.jsonPrimitive?.longOrNull
        ?: 0
    return Session(access, refresh, expiresAt, userId, claims["email"]?.jsonPrimitive?.content)
}
