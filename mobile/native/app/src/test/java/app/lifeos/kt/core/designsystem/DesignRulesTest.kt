package app.lifeos.kt.core.designsystem

import app.lifeos.kt.feature.today.fromEarlierLine
import app.lifeos.kt.feature.today.priorityLabel
import app.lifeos.kt.feature.today.tileClock
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The product rules the native design has to keep (AGENTS.md: no verdicts, one calm identity). */
class DesignRulesTest {
    @Test fun oneBrandHueByDayAndByNight() {
        // Light was blue (hue ~200) and dark teal (~179); they must now be the same teal.
        val day = hue(BrandLight.red, BrandLight.green, BrandLight.blue)
        val night = hue(BrandDark.red, BrandDark.green, BrandDark.blue)
        assertTrue("day $day vs night $night", abs(day - night) < 6f)
        assertTrue("teal, not blue: $day", day in 170f..185f)
    }

    @Test fun brandTealReadsOnWhite() {
        // White button text and teal text on white both need 4.5:1 (WCAG AA).
        assertTrue(contrast(luminance(BrandLight.red, BrandLight.green, BrandLight.blue), 1.0) >= 4.5)
    }

    @Test fun priorityIsAQuietWordOnlyWhenItMeansSomething() {
        assertEquals("High", priorityLabel("high"))
        assertEquals("Urgent", priorityLabel("critical"))
        assertNull(priorityLabel("medium"))
        assertNull(priorityLabel("low"))
    }

    @Test fun fromEarlierIsAPlainCount() {
        for (n in listOf(1, 2, 7)) {
            val line = fromEarlierLine(n).lowercase()
            assertTrue(line, line.contains("$n"))
            for (word in listOf("past", "overdue", "late", "missed", "behind")) assertFalse(line, line.contains(word))
        }
        assertEquals("Also open: 1 from earlier day.", fromEarlierLine(1))
    }

    @Test fun prayerTileClockHasNoAmPm() {
        val previous = Locale.getDefault()
        Locale.setDefault(Locale.US)
        try {
            val at = Calendar.getInstance().apply { set(2026, 10, 19, 16, 18) }.time
            assertEquals("4:18", tileClock(false).format(at))
            assertEquals("16:18", tileClock(true).format(at))
        } finally {
            Locale.setDefault(previous)
        }
    }

    private fun hue(r: Float, g: Float, b: Float): Float {
        val hi = max(r, max(g, b)); val lo = min(r, min(g, b)); val d = hi - lo
        val h = when (hi) { r -> ((g - b) / d) % 6; g -> (b - r) / d + 2; else -> (r - g) / d + 4 }
        return (h * 60 + 360) % 360
    }

    private fun channel(c: Float): Double = if (c <= 0.03928f) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
    private fun luminance(r: Float, g: Float, b: Float) = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    private fun contrast(a: Double, b: Double) = (max(a, b) + 0.05) / (min(a, b) + 0.05)
}
