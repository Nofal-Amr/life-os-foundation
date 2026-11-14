package app.lifeos.kt.core.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CallbackGateTest {
    private val start = 1_800_000_000_000L

    @Test
    fun refusesACallbackWhenNoSignInWasStarted() {
        assertFalse(CallbackGate.accepts(0L, start))
    }

    @Test
    fun acceptsACallbackSoonAfterTheAppStartedSignIn() {
        assertTrue(CallbackGate.accepts(start, start + 60_000))
        assertTrue(CallbackGate.accepts(start, start + CallbackGate.WINDOW_MS))
    }

    @Test
    fun refusesACallbackAfterTheWindow() {
        assertFalse(CallbackGate.accepts(start, start + CallbackGate.WINDOW_MS + 1))
    }

    @Test
    fun refusesACallbackDatedBeforeTheStart() {
        assertFalse(CallbackGate.accepts(start, start - 1))
    }
}
