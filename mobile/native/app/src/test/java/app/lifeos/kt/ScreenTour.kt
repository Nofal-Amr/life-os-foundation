package app.lifeos.kt

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import java.io.File
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Opens the real app in demo mode on the computer and saves a picture of each main screen,
 * so design changes can be seen without a phone. Off by default; run it with
 * `gradle :app:testDebugUnitTest --tests '*ScreenTour*' -Dlifeos.shots=/some/folder`.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class ScreenTour {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private val folder = System.getProperty("lifeos.shots").orEmpty()

    @Test fun light() = tour("light")

    @Test @Config(qualifiers = "w393dp-h852dp-night-xxhdpi") fun dark() = tour("dark")

    private fun tour(theme: String) {
        assumeTrue("screenshot tour is off (set -Dlifeos.shots)", folder.isNotBlank())
        File(folder).mkdirs()
        settle()
        shot("$theme-0-signin")
        // The phone's settings survive between the two runs, so the second starts already in demo.
        if (rule.onAllNodesWithText("Try the demo", substring = true).fetchSemanticsNodes().isNotEmpty()) tap("Try the demo")
        else tap("Reset")
        // The demo month is written on a background thread; wait until it shows.
        rule.waitUntil(15_000) { rule.onAllNodesWithText("kaitech", substring = true).fetchSemanticsNodes().isNotEmpty() }
        Thread.sleep(1500)
        settle()
        shot("$theme-1-today")
        scrollShots("$theme-1-today")
        for ((i, section) in listOf("Do", "Money", "Body", "Spirit", "More").withIndex()) {
            tap(section, last = true)
            settle()
            shot("$theme-${i + 2}-${section.lowercase()}")
            scrollShots("$theme-${i + 2}-${section.lowercase()}")
        }
        if (theme == "light") {
            toolTour("review", "light-8-review")
            toolTour("time", "light-9-time")
            toolTour("insights", "light-10-insights")
            toolTour("gym", "light-11-gym")
            toolTour("people", "light-12-people")
            settingsTour()
        }
    }

    /** From More: open a tool, picture it (and further down), then come back. */
    private fun toolTour(key: String, name: String) {
        // Straight to the tool, as a notification would open it.
        rule.runOnUiThread { androidx.lifecycle.ViewModelProvider(rule.activity)[AppViewModel::class.java].open("tool:$key") }
        settle()
        shot(name)
        scrollShots(name)
        back()
    }

    private fun back() {
        rule.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        settle()
    }

    /** More → Settings, then each part of it. */
    private fun settingsTour() {
        tap("Settings", last = true)
        settle()
        shot("light-7-settings")
        for (part in listOf("Profile", "Areas", "Prayer", "Money", "Body", "This phone", "Look", "Your data")) {
            tap(part)
            settle()
            shot("light-7-settings-${part.lowercase().replace(' ', '-')}")
            rule.activityRule.scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            settle()
        }
    }

    private fun tap(text: String, last: Boolean = false) {
        val nodes = rule.onAllNodesWithText(text, substring = true).fetchSemanticsNodes()
        check(nodes.isNotEmpty()) { "nothing says \"$text\"" }
        val all = rule.onAllNodesWithText(text, substring = true)
        (if (last) all[nodes.size - 1] else all[0]).performClick()
    }

    /** Two more pictures further down the page. */
    private fun scrollShots(name: String) {
        for (n in 1..2) {
            rule.onRoot().performTouchInput { swipeUp(startY = bottom * 0.8f, endY = bottom * 0.2f) }
            settle()
            shot("$name-$n")
        }
    }

    private fun settle() {
        repeat(3) {
            rule.waitForIdle()
            Thread.sleep(400)
            rule.mainClock.advanceTimeBy(800)
        }
        rule.waitForIdle()
    }

    private fun shot(name: String) {
        // The whole window, drawn the way the phone draws it (captureToImage stalls under Robolectric).
        lateinit var bitmap: Bitmap
        rule.runOnUiThread {
            val view = rule.activity.window.decorView
            bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(android.graphics.Canvas(bitmap))
        }
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
