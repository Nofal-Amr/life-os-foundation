package app.lifeos.kt.core.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/** A series with fewer than two points shows a plain "not enough data yet", never a fake chart. */
const val MIN_POINTS = 2

/**
 * Bars for a short run of periods (weeks, days). They grow in when shown; tap
 * a bar to read its exact value. Labels sit under the first, middle and last
 * bars so they never crowd.
 */
@Composable
fun BarChart(values: List<Pair<String, Double>>, format: (Double) -> String, modifier: Modifier = Modifier, height: androidx.compose.ui.unit.Dp = 120.dp) {
    val haptics = rememberHaptics()
    val grow = remember { Animatable(0f) }
    LaunchedEffect(values) { grow.snapTo(0f); grow.animateTo(1f, tween(600)) }
    var selected by remember(values) { mutableStateOf(values.lastIndex) }
    val max = (values.maxOfOrNull { it.second } ?: 0.0).coerceAtLeast(1.0)
    val bar = MaterialTheme.colorScheme.primary
    val dim = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
    Column(modifier.fillMaxWidth()) {
        values.getOrNull(selected)?.let { (label, value) ->
            Row(verticalAlignment = Alignment.Bottom) {
                Text(format(value), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                Spacer(Modifier.padding(start = 6.dp))
                Muted(label, style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(8.dp))
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(height)
                .pointerInput(values) {
                    detectTapGestures { offset ->
                        val slot = size.width / values.size
                        val index = (offset.x / slot).toInt().coerceIn(0, values.lastIndex)
                        if (index != selected) haptics.tick()
                        selected = index
                    }
                },
        ) {
            val slot = size.width / values.size
            val width = slot * 0.62f
            values.forEachIndexed { index, (_, value) ->
                val h = (value / max).toFloat() * size.height * grow.value
                val left = index * slot + (slot - width) / 2
                drawRoundRect(
                    color = if (index == selected) bar else dim,
                    topLeft = Offset(left, size.height - h.coerceAtLeast(if (value > 0) 3f else 0f)),
                    size = Size(width, h.coerceAtLeast(if (value > 0) 3f else 0f)),
                    cornerRadius = CornerRadius(6f, 6f),
                )
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            val marks = setOf(0, values.lastIndex / 2, values.lastIndex)
            values.forEachIndexed { index, (label, _) ->
                Text(
                    if (index in marks) label else "",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
fun NotEnoughData(hint: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        IconBadge(Icons.Outlined.Insights, size = 40.dp)
        Spacer(Modifier.height(8.dp))
        Text("Not enough data yet", style = MaterialTheme.typography.titleSmall)
        Muted(hint, style = MaterialTheme.typography.bodySmall)
    }
}
