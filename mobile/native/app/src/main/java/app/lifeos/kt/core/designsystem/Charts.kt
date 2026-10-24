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

/**
 * Stacked bars: one bar per period, split by series (largest at the base).
 * Tap a bar to read that period's total and its parts; a legend sits below.
 */
@Composable
fun StackedBarChart(
    labels: List<String>,
    series: List<Pair<String, String>>,
    values: List<Map<String, Double>>,
    format: (Double) -> String,
    modifier: Modifier = Modifier,
    height: androidx.compose.ui.unit.Dp = 140.dp,
) {
    val haptics = rememberHaptics()
    val grow = remember { Animatable(0f) }
    LaunchedEffect(values) { grow.snapTo(0f); grow.animateTo(1f, tween(650)) }
    var selected by remember(values) { mutableStateOf(values.lastIndex) }
    val palette = LifeTheme.colors.chart
    val colors = series.mapIndexed { index, (key, _) -> key to if (key == "other") MaterialTheme.colorScheme.outline else palette[index % palette.size] }.toMap()
    val totals = values.map { it.values.sum() }
    val max = (totals.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
    Column(modifier.fillMaxWidth()) {
        totals.getOrNull(selected)?.let { total ->
            Row(verticalAlignment = Alignment.Bottom) {
                Text(format(total), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                Spacer(Modifier.padding(start = 6.dp))
                Muted(labels[selected], style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(8.dp))
        Canvas(
            Modifier.fillMaxWidth().height(height).pointerInput(values) {
                detectTapGestures { offset ->
                    val index = (offset.x / (size.width / values.size)).toInt().coerceIn(0, values.lastIndex)
                    if (index != selected) haptics.tick()
                    selected = index
                }
            },
        ) {
            val slot = size.width / values.size
            val width = slot * 0.62f
            values.forEachIndexed { index, parts ->
                val left = index * slot + (slot - width) / 2
                var top = size.height
                val alpha = if (index == selected) 1f else 0.45f
                val ordered = series.map { it.first }.filter { (parts[it] ?: 0.0) > 0 }
                ordered.forEachIndexed { i, key ->
                    val h = ((parts[key] ?: 0.0) / max).toFloat() * size.height * grow.value
                    top -= h
                    val last = i == ordered.lastIndex
                    drawRoundRect(
                        color = (colors[key] ?: palette[0]).copy(alpha = alpha),
                        topLeft = Offset(left, top),
                        size = Size(width, h + if (last) 0f else 1f),
                        cornerRadius = if (last) CornerRadius(6f, 6f) else CornerRadius.Zero,
                    )
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            val marks = setOf(0, labels.lastIndex / 2, labels.lastIndex)
            labels.forEachIndexed { index, label ->
                Text(if (index in marks) label else "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(10.dp))
        // The legend doubles as the selected week's breakdown.
        val parts = values.getOrNull(selected).orEmpty()
        for ((key, name) in series) {
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                Dot(colors[key] ?: palette[0], size = 8.dp)
                Spacer(Modifier.padding(start = 8.dp))
                Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Text(parts[key]?.let(format) ?: "—", style = MaterialTheme.typography.bodyMedium.merge(Numbers), color = if (parts[key] == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

/**
 * A line through dated values (e.g. hours slept each night), drawn to scale
 * in time so gaps show as gaps. Tap anywhere to read the nearest point.
 */
@Composable
fun TrendLine(
    points: List<Pair<java.time.LocalDate, Double>>,
    from: java.time.LocalDate,
    to: java.time.LocalDate,
    format: (Double) -> String,
    modifier: Modifier = Modifier,
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary,
    height: androidx.compose.ui.unit.Dp = 120.dp,
) {
    val haptics = rememberHaptics()
    val grow = remember { Animatable(0f) }
    LaunchedEffect(points) { grow.snapTo(0f); grow.animateTo(1f, tween(700)) }
    var selected by remember(points) { mutableStateOf(points.lastIndex) }
    val span = java.time.temporal.ChronoUnit.DAYS.between(from, to).coerceAtLeast(1).toFloat()
    val lo = (points.minOfOrNull { it.second } ?: 0.0)
    val hi = (points.maxOfOrNull { it.second } ?: 1.0)
    val pad = ((hi - lo) * 0.2).coerceAtLeast(0.5)
    val min = lo - pad
    val max = hi + pad
    val fmt = java.time.format.DateTimeFormatter.ofPattern("EEE d MMM")
    val grid = MaterialTheme.colorScheme.outlineVariant
    Column(modifier.fillMaxWidth()) {
        points.getOrNull(selected)?.let { (date, value) ->
            Row(verticalAlignment = Alignment.Bottom) {
                Text(format(value), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                Spacer(Modifier.padding(start = 6.dp))
                Muted(date.format(fmt), style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(8.dp))
        Canvas(
            Modifier.fillMaxWidth().height(height).pointerInput(points) {
                detectTapGestures { offset ->
                    val index = points.indices.minByOrNull { i ->
                        kotlin.math.abs(java.time.temporal.ChronoUnit.DAYS.between(from, points[i].first) / span * size.width - offset.x)
                    } ?: return@detectTapGestures
                    if (index != selected) haptics.tick()
                    selected = index
                }
            },
        ) {
            fun x(date: java.time.LocalDate) = java.time.temporal.ChronoUnit.DAYS.between(from, date) / span * size.width
            fun y(value: Double) = (size.height - ((value - min) / (max - min)).toFloat() * size.height)
            for (line in 0..2) drawLine(grid, Offset(0f, size.height * line / 2f), Offset(size.width, size.height * line / 2f), strokeWidth = 1f)
            val visible = (points.size * grow.value).toInt().coerceAtLeast(if (points.isEmpty()) 0 else 1)
            for (i in 1 until visible) {
                drawLine(color, Offset(x(points[i - 1].first), y(points[i - 1].second)), Offset(x(points[i].first), y(points[i].second)), strokeWidth = 5f, cap = androidx.compose.ui.graphics.StrokeCap.Round)
            }
            for (i in 0 until visible) {
                val c = Offset(x(points[i].first), y(points[i].second))
                drawCircle(color, radius = if (i == selected) 11f else 6f, center = c)
                if (i == selected) drawCircle(androidx.compose.ui.graphics.Color.White, radius = 5f, center = c)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            val short = java.time.format.DateTimeFormatter.ofPattern("d MMM")
            Text(from.format(short), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(to.format(short), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
