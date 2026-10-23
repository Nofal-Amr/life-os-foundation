package app.lifeos.kt.core.vault

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.SessionSource
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** What a locked note holds inside: its real title and text. */
@Serializable
data class Sealed(val title: String, val body: String)

/**
 * The key to locked notes, held only in memory while unlocked; it's dropped
 * when the app leaves the screen. Fingerprint unlock keeps a copy wrapped by
 * a key in the phone's secure hardware that only opens after a fingerprint.
 */
@Singleton
class Vault @Inject constructor(
    private val settings: AppSettings,
    private val session: SessionSource,
) {
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var key: SecretKey? = null
    private val _unlocked = MutableStateFlow(false)
    val unlocked: StateFlow<Boolean> = _unlocked

    val fingerprintEnabled: Flow<Boolean> = settings.vaultWrapped.map { it != null }

    /**
     * Opens the vault with a passphrase. [check] is any locked note's text:
     * if given, the passphrase must open it. Without one (the first locked
     * note), any passphrase becomes the vault's.
     */
    suspend fun unlock(passphrase: CharArray, check: String?): Boolean = withContext(Dispatchers.Default) {
        val userId = session.current()?.userId ?: return@withContext false
        val candidate = VaultCrypto.deriveKey(passphrase, userId)
        if (check != null) {
            try {
                VaultCrypto.decrypt(candidate, check)
            } catch (e: VaultCrypto.WrongKey) {
                return@withContext false
            }
        }
        key = candidate
        _unlocked.value = true
        true
    }

    fun lock() {
        key = null
        _unlocked.value = false
    }

    fun seal(title: String, body: String): String =
        VaultCrypto.encrypt(requireNotNull(key) { "Vault is locked" }, json.encodeToString(Sealed.serializer(), Sealed(title, body)))

    /** The note's real title and text, or null while locked or when it doesn't open. */
    fun open(sealed: String): Sealed? {
        val k = key ?: return null
        return runCatching { json.decodeFromString(Sealed.serializer(), VaultCrypto.decrypt(k, sealed)) }.getOrNull()
    }

    /* ----------------------------- Fingerprint ---------------------------- */

    /** A cipher for the fingerprint prompt that, once approved, wraps the open vault's key. */
    fun enrolCipher(): Cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, hardwareKey(create = true)) }

    suspend fun finishEnrol(approved: Cipher) {
        val raw = requireNotNull(key) { "Vault is locked" }.encoded
        val wrapped = approved.doFinal(raw)
        settings.setVaultWrapped(b64.encodeToString(approved.iv) + "." + b64.encodeToString(wrapped))
    }

    /** A cipher for the fingerprint prompt that unwraps the key; null if fingerprint unlock isn't set up (or was reset). */
    suspend fun unlockCipher(): Cipher? {
        val stored = settings.vaultWrapped.first() ?: return null
        val iv = unb64.decode(stored.substringBefore("."))
        return try {
            Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, hardwareKey(create = false) ?: return null, GCMParameterSpec(128, iv)) }
        } catch (e: KeyPermanentlyInvalidatedException) {
            // A fingerprint was added or removed on the phone: the passphrase is needed again.
            disableFingerprint()
            null
        }
    }

    suspend fun finishUnlock(approved: Cipher): Boolean {
        val stored = settings.vaultWrapped.first() ?: return false
        val raw = runCatching { approved.doFinal(unb64.decode(stored.substringAfter("."))) }.getOrNull() ?: return false
        key = SecretKeySpec(raw, "AES")
        _unlocked.value = true
        return true
    }

    suspend fun disableFingerprint() {
        settings.setVaultWrapped(null)
        runCatching { keyStore().deleteEntry(ALIAS) }
    }

    private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun hardwareKey(create: Boolean): SecretKey? {
        (keyStore().getKey(ALIAS, null) as? SecretKey)?.let { return it }
        if (!create) return null
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
            .apply { if (Build.VERSION.SDK_INT >= 30) setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG) }
            .build()
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply { init(spec) }.generateKey()
    }

    private companion object {
        const val ALIAS = "lifeos_vault"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        val b64: Base64.Encoder = Base64.getUrlEncoder().withoutPadding()
        val unb64: Base64.Decoder = Base64.getUrlDecoder()
    }
}
