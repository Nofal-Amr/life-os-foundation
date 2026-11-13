package app.lifeos.kt.feature.spirit

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.data.logic.QIBLA_ALIGNED
import app.lifeos.kt.data.logic.azkarDone
import app.lifeos.kt.data.logic.azkarFor
import app.lifeos.kt.data.logic.azkarTimeAt
import app.lifeos.kt.data.logic.distanceToKaabaKm
import app.lifeos.kt.data.logic.normalise
import app.lifeos.kt.data.logic.qiblaBearing
import app.lifeos.kt.data.logic.tasbihOn
import app.lifeos.kt.data.logic.turnTo
import java.util.Date
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Kept on the phone, as the web keeps them in the browser: a session in progress survives leaving the page. */
private fun prefs(context: Context) = context.getSharedPreferences("spirit", Context.MODE_PRIVATE)

private val ARABIC = androidx.compose.ui.text.TextStyle(fontSize = 22.sp, lineHeight = 46.sp, textDirection = TextDirection.Rtl, textAlign = TextAlign.Right)

/* --------------------------------- Azkar --------------------------------- */

/**
 * The web's AzkarSession: one card per zikr, tap to count down. A finished
 * card folds away; finishing them all logs the session. A light tick on each
 * count, a fuller one when a card is done.
 */
@Composable
internal fun AzkarTab(s: SpiritState, model: SpiritViewModel) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    val context = LocalContext.current
    val today = s.today.toString()
    val fajr = s.todayTimes?.firstOrNull { it.key == "fajr" }?.at
    val dhuhr = s.todayTimes?.firstOrNull { it.key == "dhuhr" }?.at
    var time by rememberSaveable { mutableStateOf(azkarTimeAt(Date(), fajr, dhuhr)) }
    val items = remember(time) { azkarFor(model.azkar, time) }
    val key = "azkar:$today:$time"
    var left by remember(key) { mutableStateOf(readCounts(context, key)) }
    fun remaining(id: String, count: Int) = left[id] ?: count
    val finished = items.count { (z, _) -> remaining(z.id, z.count) == 0 }
    val done = azkarDone(s.dhikr, today, time)
    fun save(next: Map<String, Int>) {
        left = next
        prefs(context).edit().putString(key, JsonObject(next.mapValues { JsonPrimitive(it.value) }).toString()).apply()
    }
    fun logSession() = model.logDhikr(time, items.size) { toast(if (time == "morning") "Morning azkar logged." else "Evening azkar logged.") }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("morning" to "Morning · الصباح", "evening" to "Evening · المساء").forEachIndexed { index, (value, label) ->
                SegmentedButton(selected = time == value, onClick = { haptics.tick(); time = value }, shape = SegmentedButtonDefaults.itemShape(index, 2), icon = {}) { Text(label) }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            LinearProgressIndicator(
                progress = { finished.toFloat() / items.size },
                modifier = Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)),
                trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                drawStopIndicator = {},
            )
            Spacer(Modifier.width(12.dp))
            if (done) {
                Icon(Icons.Outlined.Check, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                Text(" Logged today", style = MaterialTheme.typography.labelLarge)
            } else {
                Text("$finished of ${items.size} read", style = MaterialTheme.typography.labelLarge.merge(Numbers), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        items.forEach { (zikr, text) ->
            val count = remaining(zikr.id, zikr.count)
            AzkarCard(zikr.title, zikr.source, text, count, zikr.count) {
                if (count == 0) return@AzkarCard
                val next = left + (zikr.id to count - 1)
                save(next)
                if (count - 1 > 0) {
                    haptics.tick()
                } else {
                    haptics.confirm()
                    val all = items.all { (z, _) -> (next[z.id] ?: z.count) == 0 }
                    if (all && !done) logSession()
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!done) OutlinedButton(onClick = { haptics.confirm(); logSession() }, shape = MaterialTheme.shapes.medium) { Icon(Icons.Outlined.Check, null); Spacer(Modifier.width(6.dp)); Text("Log as read") }
            TextButton(onClick = { haptics.tick(); save(emptyMap()) }) { Icon(Icons.Outlined.RestartAlt, null); Spacer(Modifier.width(6.dp)); Text("Start again") }
        }
        Muted("From Hisn al-Muslim. Log as read if you read from a book.", style = MaterialTheme.typography.bodySmall)
    }
}

private fun readCounts(context: Context, key: String): Map<String, Int> = runCatching {
    Json.parseToJsonElement(prefs(context).getString(key, "{}")!!).jsonObject.mapValues { it.value.jsonPrimitive.int }
}.getOrDefault(emptyMap())

@Composable
private fun AzkarCard(title: String, source: String?, text: String, left: Int, total: Int, onTap: () -> Unit) {
    val complete = left == 0
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && !complete) 0.985f else 1f, spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMedium), label = "press")
    val alpha by animateFloatAsState(if (complete) 0.55f else 1f, label = "done")
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .scale(scale)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainer.copy(alpha = alpha))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .clickable(interactionSource = interaction, indication = androidx.compose.material3.ripple(), onClick = onTap)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title + (source?.let { " · $it" } ?: ""),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
                modifier = Modifier.weight(1f),
            )
            val pill by animateColorAsState(if (complete) MaterialTheme.colorScheme.surfaceContainerHighest else MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), label = "pill")
            Row(Modifier.clip(CircleShape).background(pill).padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (complete) Icon(Icons.Outlined.Check, "Done", modifier = Modifier.size(14.dp))
                else Text(if (total > 1) "$left / $total" else "$left", style = MaterialTheme.typography.labelMedium.merge(Numbers), fontWeight = FontWeight.SemiBold)
            }
        }
        AnimatedVisibility(!complete, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
            val mark = MaterialTheme.colorScheme.primary
            // The verse-end sign (۝) drawn smaller and in the accent, so it separates without shouting.
            val styled = remember(text, mark) {
                androidx.compose.ui.text.buildAnnotatedString {
                    text.split("۝").forEachIndexed { i, part ->
                        if (i > 0) withStyle(androidx.compose.ui.text.SpanStyle(color = mark, fontSize = 15.sp)) { append("۝") }
                        append(part)
                    }
                }
            }
            Text(styled, style = ARABIC, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.fillMaxWidth().padding(top = 10.dp))
        }
    }
}

/* --------------------------------- Tasbih -------------------------------- */

/**
 * The web's Tasbih: pick a phrase (or type your own) and a target, then tap
 * the circle. A light tick on every count, a fuller one at each target. The
 * count stays on the phone until it's saved to the record or started again.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TasbihTab(s: SpiritState, model: SpiritViewModel) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val context = LocalContext.current
    val store = remember { prefs(context) }
    var phrase by remember { mutableStateOf(store.getString("tasbih:phrase", null) ?: model.azkar.tasbihPhrases.first()) }
    var target by remember { mutableIntStateOf(store.getInt("tasbih:target", 33)) }
    var count by remember { mutableIntStateOf(store.getInt("tasbih:count", 0)) }
    var custom by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(phrase, target, count) { store.edit().putString("tasbih:phrase", phrase).putInt("tasbih:target", target).putInt("tasbih:count", count).apply() }
    val todayTotal = tasbihOn(s.dhikr, s.today.toString())

    Column(verticalArrangement = Arrangement.spacedBy(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (option in model.azkar.tasbihPhrases) SelectChip(phrase == option, option, { haptics.tick(); phrase = option })
            if (phrase !in model.azkar.tasbihPhrases) SelectChip(true, phrase, {})
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(custom, { custom = it }, placeholder = { Text("Your own…") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            TextButton(onClick = { if (custom.isNotBlank()) { haptics.tick(); phrase = custom.trim(); custom = "" } else haptics.reject() }) { Text("Use") }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Target", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            for (option in model.azkar.tasbihTargets + 0) SelectChip(target == option, if (option == 0) "None" else "$option", { haptics.tick(); target = option })
        }
        TasbihCircle(phrase, count, target) {
            count += 1
            if (target > 0 && count % target == 0) haptics.confirm() else haptics.tick()
        }
        val rounds = if (target > 0) count / target else 0
        Muted("Today: $todayTotal saved" + if (rounds > 0) " · $rounds ${if (rounds == 1) "round" else "rounds"} now" else "")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    haptics.confirm()
                    val saved = count
                    model.logDhikr("tasbih", saved, phrase) { log -> undo("$saved saved.") { model.delete(log); count = saved } }
                    count = 0
                },
                enabled = count > 0,
                shape = MaterialTheme.shapes.medium,
            ) { Text("Save $count") }
            TextButton(onClick = {
                val was = count
                haptics.tick()
                count = 0
                if (was > 0) undo("Started again") { count = was }
            }, enabled = count > 0) { Icon(Icons.Outlined.RestartAlt, null); Spacer(Modifier.width(6.dp)); Text("Start again") }
        }
    }
}

@Composable
private fun TasbihCircle(phrase: String, count: Int, target: Int, onTap: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMedium), label = "press")
    val inRound = if (target > 0) count % target else count
    val progress by animateFloatAsState(if (target > 0) inRound.toFloat() / target else 0f, spring(stiffness = Spring.StiffnessMediumLow), label = "progress")
    val ring = MaterialTheme.colorScheme.primary
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    Box(
        Modifier
            .size(260.dp)
            .scale(scale)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .clickable(interactionSource = interaction, indication = androidx.compose.material3.ripple(), onClickLabel = "Count", onClick = onTap),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(240.dp)) {
            val stroke = 10.dp.toPx()
            drawArc(track, 0f, 360f, false, style = Stroke(stroke))
            if (target > 0) drawArc(ring, -90f, 360f * progress, false, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(phrase, style = ARABIC.copy(fontSize = 18.sp, lineHeight = 28.sp, textAlign = TextAlign.Center), maxLines = 2, modifier = Modifier.width(180.dp))
            Text("$count", style = MaterialTheme.typography.displayMedium.merge(Numbers), fontWeight = FontWeight.SemiBold)
            if (target > 0) Muted("$inRound / $target", style = MaterialTheme.typography.labelMedium)
        }
    }
}

/* --------------------------------- Qibla --------------------------------- */

/**
 * A compass to the Kaaba from the saved place. The phone's heading comes from
 * its rotation sensor, corrected from magnetic to true north for where you
 * are; a soft buzz when it's facing the Qibla (within 4°). Lay it flat.
 */
@Composable
internal fun QiblaTab(s: SpiritState, active: Boolean, setUp: () -> Unit) {
    val haptics = rememberHaptics()
    val context = LocalContext.current
    val lat = s.settings?.latitude
    val lon = s.settings?.longitude
    if (lat == null || lon == null) {
        LifeCard {
            Icon(Icons.Outlined.LocationOn, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            Text("Set your place first", style = MaterialTheme.typography.titleMedium)
            Muted("The Qibla is worked out from where you are, on the phone.")
            Spacer(Modifier.height(12.dp))
            Button(onClick = setUp, shape = MaterialTheme.shapes.medium) { Text("Set your place") }
        }
        return
    }
    val target = remember(lat, lon) { qiblaBearing(lat, lon) }
    var heading by remember { mutableStateOf<Float?>(null) }
    var lowAccuracy by remember { mutableStateOf(false) }
    val declination = remember(lat, lon) { GeomagneticField(lat.toFloat(), lon.toFloat(), 0f, System.currentTimeMillis()).declination }

    // Listen only while this tab is on screen.
    DisposableEffect(active) {
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        val matrix = FloatArray(9)
        val angles = FloatArray(3)
        var smooth: Float? = null
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(matrix, event.values)
                SensorManager.getOrientation(matrix, angles)
                val raw = normalise(Math.toDegrees(angles[0].toDouble()) + declination).toFloat()
                // Smooth along the shorter way round, so 359° → 1° doesn't spin the dial.
                val previous = smooth
                smooth = if (previous == null) raw else normalise((previous + turnTo(raw.toDouble(), previous.toDouble()) * 0.15)).toFloat()
                heading = smooth
            }
            override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
                lowAccuracy = accuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW
            }
        }
        if (active && sensor != null) manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
        onDispose { manager.unregisterListener(listener) }
    }

    val turn = heading?.let { turnTo(target, it.toDouble()) }
    val aligned = turn != null && abs(turn) <= QIBLA_ALIGNED
    LaunchedEffect(aligned) { if (aligned) haptics.confirm() }

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
        Compass(heading ?: 0f, target.toFloat(), aligned)
        Text(
            when {
                heading == null -> "No compass on this phone. The Qibla is ${target.roundToInt()}° from true north."
                aligned -> "Facing the Qibla"
                else -> "Turn ${if (turn!! > 0) "right" else "left"} ${abs(turn).roundToInt()}°"
            },
            style = MaterialTheme.typography.headlineSmall,
            color = if (aligned) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Muted("${target.roundToInt()}° from true north · ${"%,d".format(distanceToKaabaKm(lat, lon).roundToInt())} km to the Kaaba", style = MaterialTheme.typography.bodySmall)
        Muted("From ${s.settings.city ?: "your saved place"}. Lay the phone flat; its top edge points the way.", style = MaterialTheme.typography.bodySmall)
        if (lowAccuracy) Text("The compass needs calibrating: move the phone in a figure 8 a few times.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
    }
}

/** The dial turns with the phone so north stays north; the Kaaba mark sits at its bearing; the top is where the phone points. */
@Composable
private fun Compass(heading: Float, target: Float, aligned: Boolean) {
    val dial = MaterialTheme.colorScheme.outlineVariant
    val text = MaterialTheme.colorScheme.onSurfaceVariant
    val accent = MaterialTheme.colorScheme.primary
    val pointer by animateColorAsState(if (aligned) accent else MaterialTheme.colorScheme.onSurface, label = "pointer")
    val north = MaterialTheme.colorScheme.error
    Box(Modifier.size(280.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(280.dp)) {
            val r = size.minDimension / 2
            val c = center
            // Where the phone points: a fixed mark at the top.
            val tip = Path().apply { moveTo(c.x, 2f); lineTo(c.x - 14f, 30f); lineTo(c.x + 14f, 30f); close() }
            drawPath(tip, pointer)
            rotate(-heading, c) {
                drawCircle(dial, r - 40f, c, style = Stroke(2f))
                for (deg in 0 until 360 step 15) {
                    val a = Math.toRadians(deg.toDouble() - 90)
                    val outer = r - 40f
                    val inner = outer - if (deg % 90 == 0) 26f else if (deg % 45 == 0) 18f else 10f
                    drawLine(if (deg == 0) north else dial, Offset(c.x + (inner * cos(a)).toFloat(), c.y + (inner * sin(a)).toFloat()), Offset(c.x + (outer * cos(a)).toFloat(), c.y + (outer * sin(a)).toFloat()), strokeWidth = if (deg % 90 == 0) 5f else 3f, cap = StrokeCap.Round)
                }
                // The Kaaba: a filled square on the dial at its bearing, with a line from the centre.
                val ta = Math.toRadians(target.toDouble() - 90)
                val reach = r - 80f
                val end = Offset(c.x + (reach * cos(ta)).toFloat(), c.y + (reach * sin(ta)).toFloat())
                drawLine(accent.copy(alpha = 0.55f), c, end, strokeWidth = 6f, cap = StrokeCap.Round)
                rotate(target, end) { drawRect(accent, Offset(end.x - 16f, end.y - 16f), androidx.compose.ui.geometry.Size(32f, 32f)) }
            }
            drawCircle(pointer, 9f, c)
        }
        // The cardinal letters, kept upright as the dial turns.
        for ((label, deg) in listOf("N" to 0f, "E" to 90f, "S" to 180f, "W" to 270f)) {
            val a = Math.toRadians((deg - heading - 90).toDouble())
            val dist = 88f
            Text(
                label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (label == "N") FontWeight.Bold else FontWeight.Medium,
                color = if (label == "N") north else text,
                modifier = Modifier.offset((dist * cos(a)).toFloat().dp, (dist * sin(a)).toFloat().dp),
            )
        }
    }
}

