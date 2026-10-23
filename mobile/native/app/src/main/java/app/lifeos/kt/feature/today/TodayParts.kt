package app.lifeos.kt.feature.today

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CenterFocusWeak
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.SentimentDissatisfied
import androidx.compose.material.icons.outlined.SentimentNeutral
import androidx.compose.material.icons.outlined.SentimentSatisfied
import androidx.compose.material.icons.outlined.SentimentVerySatisfied
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.TagFaces
import androidx.compose.material.icons.outlined.Air
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifeTheme
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.data.logic.DAY_ORDER
import app.lifeos.kt.data.logic.Dose
import app.lifeos.kt.data.logic.BeforePayday
import app.lifeos.kt.data.logic.NextAction
import app.lifeos.kt.data.logic.PrayerSlot
import app.lifeos.kt.data.logic.RingSegment
import app.lifeos.kt.data.logic.StuckTask
import app.lifeos.kt.data.logic.TaskGroup
import app.lifeos.kt.data.logic.daysUntil
import app.lifeos.kt.data.logic.isSunnah
import app.lifeos.kt.data.logic.prayerLabel
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.relativeDay
import app.lifeos.kt.data.logic.timeKeyOf
import java.text.DateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/* ------------------------------- the ring ------------------------------- */

/** One arc per area, each filling its own share; the centre only adds the counts (no score). */
@Composable
fun TodayRing(segments: List<RingSegment>, size: Dp = 92.dp) {
    if (segments.isEmpty()) return
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val fill = MaterialTheme.colorScheme.primary
    val share = 360f / segments.size
    val gap = if (segments.size > 1) 6f else 0f
    val fractions = segments.map { s ->
        val target = if (s.total == 0) 0f else s.done.toFloat() / s.total
        animateFloatAsState(target, spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessLow), label = s.key).value
    }
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val stroke = 9.dp.toPx()
            val inset = stroke / 2
            val arc = Size(this.size.width - stroke, this.size.height - stroke)
            segments.forEachIndexed { index, _ ->
                val start = -90f + index * share + gap / 2
                val usable = share - gap
                drawArc(track, start, usable, false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
                if (fractions[index] > 0f) drawArc(fill, start, usable * fractions[index], false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${segments.sumOf { it.done }}", style = MaterialTheme.typography.titleLarge.merge(Numbers))
            Muted("of ${segments.sumOf { it.total }}", style = MaterialTheme.typography.labelSmall)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RingLegend(segments: List<RingSegment>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        for (s in segments) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(6.dp).background(MaterialTheme.colorScheme.onSurfaceVariant, CircleShape))
                Spacer(Modifier.width(6.dp))
                Muted(s.label, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.width(4.dp))
                Text("${s.done}/${s.total}", style = MaterialTheme.typography.bodySmall.merge(Numbers), fontWeight = FontWeight.Medium)
            }
        }
    }
}

/* ----------------------------- next action ----------------------------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NextActionCard(
    action: NextAction?,
    fromEarlier: Int,
    capacityFit: Boolean,
    running: TimeEntry?,
    onDone: () -> Unit,
    onFocus: () -> Unit,
    onTimer: () -> Unit,
    onHard: () -> Unit,
    onOpen: () -> Unit,
    onAdd: () -> Unit,
) {
    val haptics = rememberHaptics()
    LifeCard(modifier = Modifier.border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), MaterialTheme.shapes.large)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Next action", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
            if (action != null) IconButton(onClick = { haptics.tick(); onOpen() }) { Icon(Icons.AutoMirrored.Outlined.OpenInNew, "Open task", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (fromEarlier > 0) Muted("$fromEarlier open ${if (fromEarlier == 1) "task is" else "tasks are"} past their date.", Modifier.padding(top = 2.dp))
        Spacer(Modifier.height(14.dp))
        if (action == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Muted("No open tasks right now.", Modifier.weight(1f))
                Button(onClick = onAdd, shape = MaterialTheme.shapes.small) { Text("Add a task") }
            }
            return@LifeCard
        }
        if (action.isStep) Muted(action.parent.title, maxLines = 1, style = MaterialTheme.typography.bodySmall)
        Text(
            action.item.title + if (action.minutes != null) "  · ${action.estimate}" else "",
            style = MaterialTheme.typography.headlineSmall,
        )
        if (action.parent.postponedCount >= 3) {
            Muted(
                "Moved ${action.parent.postponedCount} times" + (action.parent.originalDueDate?.let { " since ${LocalDate.parse(it.take(10)).format(DateTimeFormatter.ofPattern("d MMM yyyy"))}" } ?: "") + ".",
                Modifier.padding(top = 6.dp),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(14.dp))
        val timing = running != null && running.taskId == action.item.id
        // One clear thing to press; the rest stay quiet beneath it.
        Button(onClick = { haptics.confirm(); onDone() }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(54.dp)) {
            Icon(Icons.Filled.Check, null, Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Done", style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            QuietAction(Icons.Outlined.CenterFocusWeak, "Focus") { haptics.tick(); onFocus() }
            QuietAction(if (timing) Icons.Outlined.Stop else Icons.Outlined.PlayArrow, if (timing) "Stop timer" else "Timer") { haptics.tick(); onTimer() }
            QuietAction(Icons.Outlined.ContentCut, "This feels hard") { haptics.tick(); onHard() }
        }
        if (capacityFit) Muted("Picked to fit your energy right now.", Modifier.padding(top = 10.dp), style = MaterialTheme.typography.bodySmall)
    }
}

/** A secondary action: an outlined pill with an icon, quieter than the main button. */
@Composable
fun QuietAction(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        Modifier
            .clip(CircleShape)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}

/* ------------------------------- stuck ------------------------------- */

@Composable
fun StuckCard(item: StuckTask, onHelp: () -> Unit, onSnooze: () -> Unit) {
    LifeCard {
        Text("This one has been waiting", style = MaterialTheme.typography.titleMedium)
        Muted("${item.task.title} · ${item.days} days · ${item.detail}", maxLines = 2)
        Spacer(Modifier.height(6.dp))
        Muted("Tasks that wait get heavier to face. That's normal, not a flaw. Let's find a way in.", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onHelp, shape = MaterialTheme.shapes.small) { Text("Help me start") }
            TextButton(onClick = onSnooze) { Text("Not today") }
        }
    }
}

/* ------------------------------ count tiles ------------------------------ */

/** Four counts, each in its own identity colour; the word says what it counts. */
@Composable
fun CountTiles(counts: List<Pair<String, Int>>, onTap: (String) -> Unit) {
    val colors = LifeTheme.colors.entity
    val style = mapOf(
        "Unsorted" to (Icons.Outlined.Inbox to colors.getValue("amber")),
        "Due today" to (Icons.Outlined.EventAvailable to colors.getValue("green")),
        "From earlier" to (Icons.Outlined.History to colors.getValue("coral")),
        "Active projects" to (Icons.Outlined.Folder to colors.getValue("blue")),
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        counts.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((label, value) in row) {
                    val (icon, color) = style[label] ?: (Icons.Outlined.Inbox to MaterialTheme.colorScheme.primary)
                    LifeCard(Modifier.weight(1f), onClick = { onTap(label) }, contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(color.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                                Icon(icon, null, tint = color, modifier = Modifier.size(19.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text("$value", style = MaterialTheme.typography.titleMedium.merge(Numbers))
                                Muted(label, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- today's focus ----------------------------- */

/** Priority wears a colour and always a word, so colour is never the only signal. */
@Composable
fun PriorityBadge(priority: String) {
    val colors = LifeTheme.colors.entity
    val (label, color) = when (priority) {
        "critical" -> "URGENT" to colors.getValue("rose")
        "high" -> "HIGH" to colors.getValue("coral")
        "medium" -> "MEDIUM" to colors.getValue("amber")
        else -> return
    }
    Text(
        label,
        color = color,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp),
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(color.copy(alpha = 0.14f)).padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun FocusList(rows: List<FocusRow>, today: LocalDate, onDone: (FocusRow) -> Unit, onOpen: (FocusRow) -> Unit) {
    val haptics = rememberHaptics()
    Column {
        var last: TaskGroup? = null
        for (row in rows) {
            if (row.group != last) {
                Muted(row.group.label, Modifier.padding(start = 4.dp, top = 10.dp, bottom = 4.dp), style = MaterialTheme.typography.labelMedium)
                last = row.group
            }
            LifeCard(Modifier.padding(vertical = 3.dp), onClick = { onOpen(row) }, contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 4.dp, end = 14.dp, top = 8.dp, bottom = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { haptics.confirm(); onDone(row) }) {
                        Icon(Icons.Outlined.Circle, "Finish “${row.action.item.title}”", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(row.action.item.title, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        if (row.action.isStep) Muted(row.action.parent.title, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        val due = row.action.parent.dueDate?.let { relativeDay(it, today) }
                        val parts = listOfNotNull(due?.let { it + (row.action.parent.dueTime?.take(5)?.let { t -> " · $t" } ?: "") }, row.project?.name, row.action.estimate.ifEmpty { null })
                        if (parts.isNotEmpty()) Muted(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    }
                    PriorityBadge(row.action.parent.priority)
                }
            }
        }
    }
}

/* ------------------------------ last 7 days ------------------------------ */

@Composable
fun HubCard(lines: List<app.lifeos.kt.data.logic.HubLine>) {
    LifeCard {
        Text("Last 7 days", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        for (line in lines) {
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                Text(line.label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(88.dp))
                Muted(line.count, Modifier.weight(1f))
            }
        }
    }
}

/* -------------------------------- check-in -------------------------------- */

/** The web's words (MOOD_LABELS, ENERGY_LABELS in src/data/reviews.ts). */
val MOOD_LABELS = listOf("Low", "Meh", "Okay", "Good", "Great")
val ENERGY_LABELS = listOf("Drained", "Low", "Steady", "Strong", "Charged")
private val MOOD_ICONS = listOf(Icons.Outlined.SentimentDissatisfied, Icons.Outlined.SentimentNeutral, Icons.Outlined.SentimentSatisfied, Icons.Outlined.SentimentVerySatisfied, Icons.Outlined.TagFaces)

/** How you feel, in two taps. Every choice is neutral; nothing is coloured as good or bad. */
@Composable
fun CheckInCard(mood: Int?, energy: Int?, setMood: (Int?) -> Unit, setEnergy: (Int?) -> Unit, onReset: () -> Unit) {
    val haptics = rememberHaptics()
    LifeCard {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text("How are you right now?", style = MaterialTheme.typography.titleMedium)
                Muted(
                    if (mood != null && energy != null) "${MOOD_LABELS[mood - 1]} · ${ENERGY_LABELS[energy - 1]} energy. Tap to change." else "Two taps. It goes into today's review.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            OutlinedButton(onClick = onReset, shape = CircleShape, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp)) {
                Icon(Icons.Outlined.Air, null, Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("1-minute reset", style = MaterialTheme.typography.labelMedium)
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            MOOD_LABELS.forEachIndexed { index, label ->
                ChoiceTile(Modifier.weight(1f), selected = mood == index + 1, label = label, onClick = { haptics.tick(); setMood(if (mood == index + 1) null else index + 1) }) {
                    Icon(MOOD_ICONS[index], null, Modifier.size(22.dp))
                }
            }
        }
        Muted("Energy", Modifier.padding(top = 14.dp, bottom = 6.dp), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ENERGY_LABELS.forEachIndexed { index, label ->
                ChoiceTile(Modifier.weight(1f), selected = energy == index + 1, label = label, onClick = { haptics.tick(); setEnergy(if (energy == index + 1) null else index + 1) }) {
                    // Filled bars show the level; the label says it in words.
                    val color = androidx.compose.material3.LocalContentColor.current
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        for (bar in 0..4) Box(Modifier.width(3.dp).height((4 + bar * 2).dp).background(color.copy(alpha = if (bar <= index) 1f else 0.2f), RoundedCornerShape(1.dp)))
                    }
                }
            }
        }
    }
}

@Composable
private fun ChoiceTile(modifier: Modifier, selected: Boolean, label: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    val border = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
    androidx.compose.runtime.CompositionLocalProvider(
        androidx.compose.material3.LocalContentColor provides if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
    ) {
        Column(
            modifier
                .heightIn(min = 58.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else Color.Transparent)
                .border(1.dp, border, RoundedCornerShape(12.dp))
                .clickable(onClick = onClick)
                .padding(vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            icon()
            Spacer(Modifier.height(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1, textAlign = TextAlign.Center)
        }
    }
}

/* -------------------------------- strips -------------------------------- */

/**
 * One line per area: its icon, what's true today, and the whole line opens
 * the place to log it ([linkLabel] is read out to screen readers). Rows with
 * controls carry them underneath; [action] is an extra button (money's breakdown).
 */
@Composable
fun StatusRow(
    icon: ImageVector,
    label: String,
    value: String,
    linkLabel: String,
    onLink: () -> Unit,
    aside: (@Composable () -> Unit)? = null,
    action: (@Composable () -> Unit)? = null,
    content: (@Composable () -> Unit)? = null,
) {
    val haptics = rememberHaptics()
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClickLabel = linkLabel) { haptics.tick(); onLink() }
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Muted(value, style = MaterialTheme.typography.bodySmall)
            }
            aside?.let {
                Spacer(Modifier.width(8.dp))
                it()
            }
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
        }
        content?.invoke()
        if (action != null) {
            Spacer(Modifier.height(10.dp))
            Box(Modifier.padding(start = 32.dp)) { action() }
        }
        if (content != null || action != null) Spacer(Modifier.height(12.dp))
    }
}

/** Small filled/hollow dots: a second reading of a count already written in words. */
@Composable
fun Dots(filled: Int, total: Int) {
    if (total <= 0) return
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(total) { i ->
            val on = i < filled
            Box(Modifier.size(8.dp).clip(CircleShape).then(if (on) Modifier.background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)) else Modifier.border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)))
        }
    }
}

/** Each status has its own colour and word, and none is painted good or bad (the web's STATUS_STYLE). */
@Composable
fun statusColor(status: String): Color {
    val chart = LifeTheme.colors.chart
    return when (status) {
        "jamaah" -> chart[1]
        "on_time" -> chart[0]
        "clutch" -> chart[2]
        "late" -> chart[3]
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

fun statusLabel(status: String) = when (status) {
    "jamaah" -> "In jamaah"
    "on_time" -> "On time"
    "clutch" -> "Clutch"
    "late" -> "Late"
    "missed" -> "Missed"
    else -> status
}

/** The seven of the day (Sunnah, the five, Witr) as tiles; tap one to say how it was prayed. */
@Composable
fun PrayerTiles(today: LocalDate, logs: List<PrayerLog>, times: List<PrayerSlot>?, onPick: (String) -> Unit) {
    val clock = DateFormat.getTimeInstance(DateFormat.SHORT)
    val nextKey = times?.firstOrNull { it.at.after(java.util.Date()) }?.key
    val sunnahRing = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for ((name, _) in DAY_ORDER) {
            val status = prayerStatus(logs.firstOrNull { it.prayerDate == today.toString() && it.prayerName == name })
            val time = times?.firstOrNull { it.key == timeKeyOf(name) }?.at
            val bg = if (status != null) statusColor(status) else Color.Transparent
            Column(
                Modifier
                    .weight(1f)
                    .heightIn(min = 70.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(bg)
                    .border(if (isSunnah(name)) 1.5.dp else 1.dp, if (status != null) Color.Transparent else if (isSunnah(name)) sunnahRing else MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                    .clickable { onPick(name) }
                    .padding(vertical = 8.dp, horizontal = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                val onBg = if (status != null) Color.White else MaterialTheme.colorScheme.onSurface
                Text(prayerLabel(name, today), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium, color = onBg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (time != null) Text(clock.format(time).replace(" ", " "), style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp).merge(Numbers), color = onBg.copy(alpha = 0.8f), maxLines = 1)
                Text(
                    when {
                        status != null -> statusLabel(status)
                        nextKey == name -> "Next"
                        else -> "Log"
                    },
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                    color = when {
                        status != null -> onBg
                        nextKey == name -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (nextKey == name && status == null) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DoseTiles(doses: List<Dose>, onToggle: (Dose) -> Unit) {
    val haptics = rememberHaptics()
    FlowRow(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), maxItemsInEachRow = 2) {
        for (dose in doses) {
            Column(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (dose.taken) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f) else Color.Transparent)
                    .border(1.dp, if (dose.taken) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                    .clickable { if (!dose.taken) haptics.confirm() else haptics.tick(); onToggle(dose) }
                    .padding(10.dp),
            ) {
                Text(dose.medication.name + (dose.medication.dosage?.let { " $it" } ?: ""), style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Muted(dose.slot.take(5), style = MaterialTheme.typography.bodySmall)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (dose.taken) Icon(Icons.Filled.Check, null, Modifier.size(14.dp))
                    Text(if (dose.taken) "Taken" else "Not taken", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/** What's liquid split into the person's own parts: committed, buffer, and what's left. Every part is also in words. */
@Composable
fun MoneySplit(totals: BeforePayday, money: MoneyFormatter) {
    val spendable = maxOf(totals.available, 0.0)
    val total = totals.committed + totals.buffer + spendable
    if (total <= 0) return
    val committedColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f)
    val bufferColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.25f)
    val leftColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
    Column(Modifier.padding(top = 10.dp, start = 32.dp)) {
        Row(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)) {
            if (totals.committed > 0) Box(Modifier.weight((totals.committed / total).toFloat()).height(8.dp).background(committedColor))
            if (totals.buffer > 0) Box(Modifier.weight((totals.buffer / total).toFloat()).height(8.dp).background(bufferColor))
            if (spendable > 0) Box(Modifier.weight((spendable / total).toFloat()).height(8.dp).background(leftColor))
        }
        Muted("Balance now ${money.format(totals.liquid)} · Recurring before payday ${money.format(totals.committed)} · Buffer ${money.format(totals.buffer)}", Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall)
    }
}

/** Days between the person's own two paydays. No score, just the dates. */
@Composable
fun PaydayLine(from: LocalDate, to: LocalDate) {
    val span = maxOf(1L, ChronoUnit.DAYS.between(from, to))
    // Counted the way people count days: payday itself is day 1 (the web's figure drifts with the time of day).
    val elapsed = (ChronoUnit.DAYS.between(from, LocalDate.now()) + 1).coerceIn(1, span)
    val format = DateTimeFormatter.ofPattern("d MMM yyyy")
    Column(Modifier.padding(top = 10.dp, start = 32.dp)) {
        Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.outline)) {
            Box(Modifier.fillMaxWidth(elapsed.toFloat() / span).height(4.dp).background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)))
        }
        Muted("Day $elapsed of $span since ${from.format(format)} · next ${to.format(format)}", Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall)
    }
}

/** "12:34" since a running timer started. */
fun elapsedSince(startedAt: String, now: Instant = Instant.now()): String {
    val start = runCatching { java.time.OffsetDateTime.parse(startedAt).toInstant() }.getOrNull() ?: return ""
    val seconds = maxOf(0, ChronoUnit.SECONDS.between(start, now))
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

