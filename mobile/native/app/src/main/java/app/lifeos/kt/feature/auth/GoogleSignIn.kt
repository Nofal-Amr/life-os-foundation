package app.lifeos.kt.feature.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import app.lifeos.kt.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/** Whether this build knows the Google client ID; without it, Google sign-in goes through the website. */
val nativeGoogleSignIn: Boolean get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

/** What Google handed back: the ID token, and the raw nonce Supabase checks it against. */
data class GoogleToken(val idToken: String, val nonce: String)

sealed interface GoogleResult {
    data class Token(val token: GoogleToken) : GoogleResult
    /** The person closed the picker: say nothing. */
    data object Cancelled : GoogleResult
    data class Failed(val message: String) : GoogleResult
}

/**
 * Android's own "Sign in with Google" sheet. A fresh nonce ties the token to
 * this attempt: Google gets its SHA-256, Supabase the raw value (as on the web).
 */
suspend fun googleSignIn(context: Context): GoogleResult {
    val raw = ByteArray(24).also(SecureRandom()::nextBytes).let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
    val hashed = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString("") { "%02x".format(it) }
    val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).setNonce(hashed).build()
    return try {
        val result = CredentialManager.create(context).getCredential(context, GetCredentialRequest.Builder().addCredentialOption(option).build())
        val credential = result.credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            GoogleResult.Token(GoogleToken(GoogleIdTokenCredential.createFrom(credential.data).idToken, raw))
        } else {
            GoogleResult.Failed("Google didn't send a sign-in token.")
        }
    } catch (e: GetCredentialCancellationException) {
        GoogleResult.Cancelled
    } catch (e: GetCredentialException) {
        GoogleResult.Failed(e.message ?: "Google sign-in didn't finish.")
    }
}
