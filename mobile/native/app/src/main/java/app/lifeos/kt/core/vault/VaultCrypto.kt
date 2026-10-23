package app.lifeos.kt.core.vault

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Locked notes: encrypted on the phone, so the server (and anyone who ever
 * copied its database) only holds unreadable text.
 *
 * - Key: PBKDF2-SHA256 from the person's passphrase, 310,000 rounds, salted
 *   per account. The passphrase never leaves the phone and can't be recovered.
 * - Each note: AES-256-GCM with a fresh 12-byte IV; GCM also detects tampering.
 * - Format: `lifeos-vault:v1:<iv>.<ciphertext>` (base64url), chosen so the web
 *   app can open the same notes with WebCrypto later.
 */
object VaultCrypto {
    const val PREFIX = "lifeos-vault:v1:"
    /** What the server sees as the title of a locked note. */
    const val LOCKED_TITLE = "Locked note"
    private const val ROUNDS = 310_000
    private val random = SecureRandom()
    private val b64 = Base64.getUrlEncoder().withoutPadding()
    private val unb64 = Base64.getUrlDecoder()

    fun isLocked(body: String?): Boolean = body?.startsWith(PREFIX) == true

    /** Slow on purpose (a fraction of a second): it's what makes guessing passphrases expensive. */
    fun deriveKey(passphrase: CharArray, userId: String): SecretKey {
        val salt = MessageDigest.getInstance("SHA-256").digest("lifeos-vault-v1:$userId".toByteArray())
        val spec = PBEKeySpec(passphrase, salt, ROUNDS, 256)
        try {
            val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
            return SecretKeySpec(bytes, "AES")
        } finally {
            spec.clearPassword()
        }
    }

    fun encrypt(key: SecretKey, plaintext: String): String {
        val iv = ByteArray(12).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv)) }
        return PREFIX + b64.encodeToString(iv) + "." + b64.encodeToString(cipher.doFinal(plaintext.toByteArray()))
    }

    /** Throws [WrongKey] when the passphrase is wrong (or the text was changed). */
    fun decrypt(key: SecretKey, sealed: String): String {
        require(isLocked(sealed)) { "Not a locked note" }
        val (iv, data) = sealed.removePrefix(PREFIX).split(".", limit = 2).let { unb64.decode(it[0]) to unb64.decode(it[1]) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv)) }
        return try {
            String(cipher.doFinal(data))
        } catch (e: AEADBadTagException) {
            throw WrongKey()
        }
    }

    class WrongKey : Exception("That passphrase doesn't open this note.")
}
