package app.lifeos.kt.core.designsystem

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// The web app's tokens (src/styles.css), converted from OKLCH.

private val Light = lightColorScheme(
    primary = Color(0xFF0284C7),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0EFF8),
    onPrimaryContainer = Color(0xFF0B4F78),
    secondary = Color(0xFF0E7C78),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE0EFF8),
    onSecondaryContainer = Color(0xFF0B4F78),
    tertiary = Color(0xFF6A5AE0),
    background = Color(0xFFF8F9FB),
    onBackground = Color(0xFF141B2D),
    surface = Color(0xFFF8F9FB),
    onSurface = Color(0xFF141B2D),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFCFCFD),
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color(0xFFF4F6F9),
    surfaceContainerHighest = Color(0xFFEDF0F4),
    surfaceVariant = Color(0xFFF1F3F7),
    onSurfaceVariant = Color(0xFF5F6E86),
    outline = Color(0x1F141B2D),
    outlineVariant = Color(0x0F141B2D),
    error = Color(0xFFB4383A),
    inverseSurface = Color(0xFF1E2433),
    inverseOnSurface = Color(0xFFF1F4F8),
)

private val Dark = darkColorScheme(
    primary = Color(0xFF3CC6C4),
    onPrimary = Color(0xFF0E1014),
    primaryContainer = Color(0xFF173A3D),
    onPrimaryContainer = Color(0xFFBFF0EE),
    secondary = Color(0xFF5BB8E8),
    onSecondary = Color(0xFF0E1014),
    secondaryContainer = Color(0xFF173A3D),
    onSecondaryContainer = Color(0xFFBFF0EE),
    tertiary = Color(0xFF9D8CFF),
    background = Color(0xFF0E1014),
    onBackground = Color(0xFFF1F4F8),
    surface = Color(0xFF0E1014),
    onSurface = Color(0xFFF1F4F8),
    surfaceContainerLowest = Color(0xFF0B0D10),
    surfaceContainerLow = Color(0xFF14171D),
    surfaceContainer = Color(0xFF191C24),
    surfaceContainerHigh = Color(0xFF20242E),
    surfaceContainerHighest = Color(0xFF282D38),
    surfaceVariant = Color(0xFF20242E),
    onSurfaceVariant = Color(0xFF97A3B6),
    outline = Color(0x24FFFFFF),
    outlineVariant = Color(0x12FFFFFF),
    error = Color(0xFFE0524A),
    inverseSurface = Color(0xFFF1F4F8),
    inverseOnSurface = Color(0xFF14171D),
)

/**
 * Colours beyond Material's roles: the five chart series (checked for
 * colour-blind separation) and the eight entity colours projects and
 * categories pick from. Colour never carries meaning alone.
 */
@Immutable
data class LifeColors(
    val chart: List<Color>,
    val entity: Map<String, Color>,
    /** The recessed well behind a stat's number. */
    val well: Color,
)

private val LightLife = LifeColors(
    chart = listOf(Color(0xFF2563A8), Color(0xFF1F948C), Color(0xFF6A3FD0), Color(0xFFC98A2E), Color(0xFFC94A7C)),
    entity = mapOf(
        "blue" to Color(0xFF1F78C8), "teal" to Color(0xFF13827D), "green" to Color(0xFF2E8A4E), "amber" to Color(0xFFB7862B),
        "coral" to Color(0xFFC8603F), "rose" to Color(0xFFC24A63), "violet" to Color(0xFF7A55C8), "slate" to Color(0xFF66748A),
    ),
    well = Color(0xFFF5F7FA),
)

private val DarkLife = LifeColors(
    chart = listOf(Color(0xFF6AA8F0), Color(0xFF4FD1C5), Color(0xFFA88BFA), Color(0xFFF0B45A), Color(0xFFF07AA8)),
    entity = mapOf(
        "blue" to Color(0xFF6AB0F5), "teal" to Color(0xFF4FC9C2), "green" to Color(0xFF6CC98C), "amber" to Color(0xFFE8B860),
        "coral" to Color(0xFFF09070), "rose" to Color(0xFFF07A93), "violet" to Color(0xFFB39AF5), "slate" to Color(0xFF9AA6B8),
    ),
    well = Color(0xFF14171D),
)

val LocalLifeColors = staticCompositionLocalOf { LightLife }

object LifeTheme {
    val colors: LifeColors @Composable get() = LocalLifeColors.current
}

/** Tabular figures, so amounts and counts line up and don't jitter while they animate. */
val Numbers = TextStyle(fontFeatureSettings = "tnum")

private val LifeTypography = Typography().let { base ->
    base.copy(
        displaySmall = base.displaySmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.5).sp),
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.5).sp),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.4).sp),
        headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        titleSmall = base.titleSmall.copy(fontWeight = FontWeight.SemiBold),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Medium),
        labelMedium = base.labelMedium.copy(fontWeight = FontWeight.Medium, letterSpacing = 0.2.sp),
    )
}

/** 8 dp controls, 12–16 dp cards, as on the web. */
private val LifeShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun LifeOsTheme(dynamicColor: Boolean = false, content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val scheme: ColorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(LocalContext.current) else dynamicLightColorScheme(LocalContext.current)
        dark -> Dark
        else -> Light
    }
    CompositionLocalProvider(LocalLifeColors provides if (dark) DarkLife else LightLife) {
        MaterialTheme(colorScheme = scheme, typography = LifeTypography, shapes = LifeShapes, content = content)
    }
}
