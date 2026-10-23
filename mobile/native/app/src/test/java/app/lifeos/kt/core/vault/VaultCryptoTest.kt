package app.lifeos.kt.core.vault

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class VaultCryptoTest {
    private val key = VaultCrypto.deriveKey("correct horse battery".toCharArray(), "user-1")

    @Test
    fun aLockedNoteOpensWithTheRightPassphraseOnly() {
        val sealed = VaultCrypto.encrypt(key, "bank PIN is not here")
        assertTrue(VaultCrypto.isLocked(sealed))
        assertFalse(sealed.contains("bank"))
        assertEquals("bank PIN is not here", VaultCrypto.decrypt(VaultCrypto.deriveKey("correct horse battery".toCharArray(), "user-1"), sealed))
        assertThrows(VaultCrypto.WrongKey::class.java) { VaultCrypto.decrypt(VaultCrypto.deriveKey("wrong".toCharArray(), "user-1"), sealed) }
    }

    @Test
    fun theSamePassphraseGivesADifferentKeyForAnotherAccount() {
        val sealed = VaultCrypto.encrypt(key, "secret")
        assertThrows(VaultCrypto.WrongKey::class.java) { VaultCrypto.decrypt(VaultCrypto.deriveKey("correct horse battery".toCharArray(), "user-2"), sealed) }
    }

    @Test
    fun everySealIsDifferentEvenForTheSameText() {
        assertNotEquals(VaultCrypto.encrypt(key, "same"), VaultCrypto.encrypt(key, "same"))
    }

    @Test
    fun aChangedCiphertextIsRejected() {
        val sealed = VaultCrypto.encrypt(key, "secret")
        val tampered = sealed.dropLast(2) + (if (sealed.last() == 'A') "BB" else "AA")
        assertThrows(VaultCrypto.WrongKey::class.java) { VaultCrypto.decrypt(key, tampered) }
    }
}
