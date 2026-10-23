package app.lifeos.kt.data

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Base64
import org.json.JSONArray
import org.json.JSONObject

/** The server answered and said no (as opposed to "couldn't reach it"). */
class ServerError(val code: Int, val body: String) : IOException("HTTP $code: ${body.take(200)}")

/** A signed-in session. [expiresAt] is in epoch seconds. */
data class SessionData(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val userId: String,
    val email: String?,
) {
    companion object {
        /** From an auth/v1/token response. */
        fun fromToken(json: JSONObject): SessionData {
            val user = json.getJSONObject("user")
            return SessionData(
                accessToken = json.getString("access_token"),
                refreshToken = json.getString("refresh_token"),
                expiresAt = json.optLong("expires_at").takeIf { it > 0 }
                    ?: (System.currentTimeMillis() / 1000 + json.optLong("expires_in", 3600)),
                userId = user.getString("id"),
                email = user.str("email"),
            )
        }

        /**
         * From the website's hand-back after Google sign-in:
         * lifeosnative://auth-callback#access_token=…&refresh_token=…&expires_in=… .
         * The user comes from the token's own claims.
         */
        fun fromCallbackFragment(fragment: String): SessionData? {
            val params = fragment.split("&").mapNotNull { part ->
                val pair = part.split("=", limit = 2)
                if (pair.size == 2) pair[0] to java.net.URLDecoder.decode(pair[1], "UTF-8") else null
            }.toMap()
            val access = params["access_token"] ?: return null
            val refresh = params["refresh_token"] ?: return null
            val claims = jwtClaims(access) ?: return null
            val expiresAt = params["expires_at"]?.toLongOrNull()
                ?: params["expires_in"]?.toLongOrNull()?.let { System.currentTimeMillis() / 1000 + it }
                ?: claims.optLong("exp")
            return SessionData(access, refresh, expiresAt, claims.optString("sub").ifEmpty { return null }, claims.str("email"))
        }

        private fun jwtClaims(token: String): JSONObject? = try {
            JSONObject(String(Base64.getUrlDecoder().decode(token.split(".")[1])))
        } catch (e: Exception) {
            null
        }
    }
}

/** A JSON value that may be null; org.json's optString turns null into "null". */
fun JSONObject.str(key: String): String? = if (isNull(key)) null else getString(key)

/**
 * A small client for Supabase's auth and table endpoints. Blocking: call it
 * off the main thread. No connection throws IOException; a refusal throws
 * [ServerError].
 */
class Supabase(private val baseUrl: String, private val key: String) {

    fun signInWithPassword(email: String, password: String): SessionData {
        val body = JSONObject().put("email", email).put("password", password)
        return SessionData.fromToken(JSONObject(call("POST", "/auth/v1/token?grant_type=password", null, body.toString())))
    }

    fun refresh(refreshToken: String): SessionData {
        val body = JSONObject().put("refresh_token", refreshToken)
        return SessionData.fromToken(JSONObject(call("POST", "/auth/v1/token?grant_type=refresh_token", null, body.toString())))
    }

    /** Rows of [table]; [query] is PostgREST's (select=…&order=…). */
    fun select(table: String, query: String, token: String): JSONArray =
        JSONArray(call("GET", "/rest/v1/$table?$query", token, null))

    /**
     * Inserts or updates, matching on [conflict] (a unique key); only the
     * columns sent are written. Every row needs the same keys.
     */
    fun upsert(table: String, rows: JSONArray, token: String, conflict: String = "id") {
        call("POST", "/rest/v1/$table?on_conflict=$conflict", token, rows.toString(), "resolution=merge-duplicates,return=minimal")
    }

    fun delete(table: String, id: String, token: String) {
        call("DELETE", "/rest/v1/$table?id=eq.${URLEncoder.encode(id, "UTF-8")}", token, null, "return=minimal")
    }

    private fun call(method: String, path: String, token: String?, body: String?, prefer: String? = null): String {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("apikey", key)
            connection.setRequestProperty("Authorization", "Bearer ${token ?: key}")
            connection.setRequestProperty("Accept", "application/json")
            if (prefer != null) connection.setRequestProperty("Prefer", prefer)
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw ServerError(code, text)
            return text
        } finally {
            connection.disconnect()
        }
    }
}
