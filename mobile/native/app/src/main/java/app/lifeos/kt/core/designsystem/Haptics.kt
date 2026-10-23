package app.lifeos.kt.core.designsystem

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalView

/**
 * Touch feedback with meaning, through the phone's own haptics engine (so it
 * respects the system's vibration setting and feels native on every phone).
 *
 * - [tick]: a choice changed (chip, tab, toggle, stepper).
 * - [confirm]: something was saved or finished (task done, prayer logged, payment saved).
 * - [reject]: the action can't happen (empty title, nothing to undo).
 * - [longPress]: a menu or drag started.
 * - [threshold]: a swipe passed the point where letting go acts.
 */
@Stable
class Haptics(private val view: View, private val enabled: () -> Boolean) {
    fun tick() = perform(if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.SEGMENT_TICK else HapticFeedbackConstants.CLOCK_TICK)
    fun confirm() = perform(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY)
    fun reject() = perform(if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS)
    fun longPress() = perform(HapticFeedbackConstants.LONG_PRESS)
    fun threshold() = perform(
        if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE
        else if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.GESTURE_START else HapticFeedbackConstants.VIRTUAL_KEY,
    )

    private fun perform(constant: Int) {
        if (enabled()) view.performHapticFeedback(constant)
    }
}

/** Whether the app's own haptics switch is on (Settings); provided at the root. */
val LocalHapticsEnabled = staticCompositionLocalOf { true }

@Composable
fun rememberHaptics(): Haptics {
    val view = LocalView.current
    val enabled = LocalHapticsEnabled.current
    return remember(view, enabled) { Haptics(view) { enabled } }
}
