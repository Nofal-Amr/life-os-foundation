package app.lifeos.kt.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Areas behave as on the website (src/data/modules.ts). */
class SettingsRulesTest {
    @Test fun neverChosenMeansEverythingButOptIn() {
        assertTrue(moduleOn(null, "money"))
        assertTrue(moduleOn(emptyList(), "spirit"))
        assertFalse(moduleOn(emptyList(), "work"))
        assertFalse(moduleOn(null, "relationships"))
    }

    @Test fun aChosenListIsExact() {
        assertTrue(moduleOn(listOf("work"), "work"))
        assertFalse(moduleOn(listOf("work"), "money"))
    }

    @Test fun switchingOffFromNeverChosenKeepsTheRest() {
        val after = toggleModule(null, "money", false)
        assertFalse("money" in after)
        assertTrue("spirit" in after)
        assertFalse("work" in after)
    }

    @Test fun switchingOnAddsOnce() {
        assertEquals(listOf("do", "work"), toggleModule(listOf("do", "work"), "work", true))
        assertEquals(listOf("do", "work"), toggleModule(listOf("do"), "work", true))
    }
}
