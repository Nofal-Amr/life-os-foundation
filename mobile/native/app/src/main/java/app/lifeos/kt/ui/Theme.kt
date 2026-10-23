package app.lifeos.kt.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The web app's tokens (src/styles.css), converted from OKLCH.
private val Light = lightColorScheme(
    primary = Color(0xFF0284C7),
    onPrimary = Color.White,
    secondaryContainer = Color(0xFFE0EFF8),
    onSecondaryContainer = Color(0xFF0B4F78),
    background = Color(0xFFF8F9FB),
    onBackground = Color(0xFF141B2D),
    surface = Color(0xFFF8F9FB),
    onSurface = Color(0xFF141B2D),
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color.White,
    surfaceVariant = Color(0xFFF1F3F7),
    onSurfaceVariant = Color(0xFF5F6E86),
    outline = Color(0x1A141B2D),
    outlineVariant = Color(0x0F141B2D),
    error = Color(0xFFB4383A),
)

private val Dark = darkColorScheme(
    primary = Color(0xFF3CC6C4),
    onPrimary = Color(0xFF0E1014),
    secondaryContainer = Color(0xFF173A3D),
    onSecondaryContainer = Color(0xFFBFF0EE),
    background = Color(0xFF0E1014),
    onBackground = Color(0xFFF1F4F8),
    surface = Color(0xFF0E1014),
    onSurface = Color(0xFFF1F4F8),
    surfaceContainer = Color(0xFF191C24),
    surfaceContainerHigh = Color(0xFF191C24),
    surfaceVariant = Color(0xFF20242E),
    onSurfaceVariant = Color(0xFF97A3B6),
    outline = Color(0x1FFFFFFF),
    outlineVariant = Color(0x12FFFFFF),
    error = Color(0xFFE0524A),
)

@Composable
fun LifeOsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
