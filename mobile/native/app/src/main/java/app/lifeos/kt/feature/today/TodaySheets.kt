package app.lifeos.kt.feature.today

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.logic.BeforePayday
import app.lifeos.kt.data.logic.PRAYER_STATUSES
import app.lifeos.kt.data.logic.prayerLabel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

internal val STATUS_ICONS: Map<String, ImageVector> = mapOf(
    "jamaah" to Icons.Outlined.Groups,
    "on_time" to Icons.Filled.Check,
    "clutch" to Icons.Outlined.Bolt,
    "late" to Icons.Outlined.AccessTime,
    "missed" to Icons.Outlined.Close,
)

/** "How was it prayed?" — five neutral choices, each with its own icon and word; tap the current one to clear. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrayerStatusSheet(name: String, today: LocalDate, current: String?, pick: (String?) -> Unit, close: () -> Unit) {
    val haptics = rememberHaptics()
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp)) {
            Text("How was ${prayerLabel(name, today)} prayed?", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(16.dp))
            for ((value, label) in PRAYER_STATUSES) {
                val selected = current == value
                val color = statusColor(value)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (selected) color.copy(alpha = 0.16f) else Color.Transparent)
                        .border(1.dp, if (selected) color else MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
                        .clickable {
                            if (selected) haptics.tick() else if (value == "missed") haptics.tick() else haptics.confirm()
                            pick(if (selected) null else value)
                            close()
                        }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(30.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
                        Icon(STATUS_ICONS.getValue(value), null, tint = Color.White, modifier = Modifier.size(17.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    if (selected) Muted("Tap to clear", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

/** One thing, for a set time. Its minutes are logged like any timer; a chosen habit is ticked when it ends. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FocusSheet(task: Task?, habits: List<Habit>, start: (label: String, minutes: Int, habit: Habit?) -> Unit, close: () -> Unit) {
    val haptics = rememberHaptics()
    var minutes by rememberSaveable { mutableIntStateOf(25) }
    var custom by rememberSaveable { mutableStateOf("") }
    var label by rememberSaveable { mutableStateOf(task?.title.orEmpty()) }
    var habitId by rememberSaveable { mutableStateOf<String?>(null) }
    val length = custom.toIntOrNull() ?: minutes
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Focus", style = MaterialTheme.typography.titleLarge)
            Muted("One thing, for a set time. You'll feel a soft buzz and hear a chime when it's done.")
            Eyebrow("How long")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (preset in listOf(15, 25, 50)) SelectChip(custom.isEmpty() && minutes == preset, "$preset min", { minutes = preset; custom = "" })
            }
            OutlinedTextField(value = custom, onValueChange = { custom = it.filter(Char::isDigit).take(3) }, label = { Text("Or minutes") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("What it's for") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            if (habits.isNotEmpty()) {
                Eyebrow("Tick a habit when it's done (optional)")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (habit in habits) SelectChip(habitId == habit.id, habit.name, { habitId = if (habitId == habit.id) null else habit.id })
                }
            }
            Button(
                onClick = {
                    if (length !in 1..240) {
                        haptics.reject()
                    } else {
                        haptics.confirm()
                        start(label, length, habits.firstOrNull { it.id == habitId })
                        close()
                    }
                },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("Start $length minutes") }
        }
    }
}

/* ----------------------------- this feels hard ----------------------------- */

/** What usually keeps a task stuck, each answered with one concrete move (after How to ADHD's "Wall of Awful"). */
private val BLOCKS = listOf(
    "unclear" to "I don't know where to start",
    "dread" to "I'm dreading it",
    "boring" to "It's boring",
    "energy" to "No energy for it now",
    "waiting" to "I'm waiting on someone",
    "pointless" to "It doesn't matter any more",
)

private val WAYS = mapOf(
    "unclear" to "When the start is fuzzy, the whole task feels impossible. Make the first step so small it's almost silly: open the file, find the email.",
    "dread" to "The longer a task waits, the higher the wall around it gets. You don't have to climb it all today: start for five minutes, and stopping after that still counts.",
    "boring" to "A bored brain needs something to make it interesting: a short sprint against the clock, music on, or someone working beside you (body doubling).",
    "energy" to "Some tasks need a better day. Give it a real day instead of “later”, or do five easy minutes now so it's started.",
    "waiting" to "If it's stuck on someone else, the next step is one message, not the whole task.",
    "pointless" to "Plans change. Letting a task go is a decision too, and it frees the space it was taking.",
)

/** "What makes it hard?" and then one thing to do about it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StuckHelperSheet(
    task: Task,
    close: () -> Unit,
    shrink: () -> Unit,
    sprint: (minutes: Int) -> Unit,
    moveTo: (String) -> Unit,
    addStep: (String) -> Unit,
    setStatus: (String) -> Unit,
    together: () -> Unit,
) {
    val haptics = rememberHaptics()
    var block by rememberSaveable { mutableStateOf<String?>(null) }
    var day by rememberSaveable { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        AnimatedContent(block, transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(120)) }, label = "block") { chosen ->
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(if (chosen == null) "What makes it hard?" else "Here's a way in", style = MaterialTheme.typography.titleLarge)
                Muted("“${task.title}”", maxLines = 2)
                if (chosen == null) {
                    for ((value, label) in BLOCKS) {
                        OutlinedButton(onClick = { haptics.tick(); block = value }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                            Text(label, modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                    Muted("Pick the closest one. There's no wrong answer.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Text(WAYS.getValue(chosen), style = MaterialTheme.typography.bodyLarge)
                    val primary: @Composable (String, () -> Unit) -> Unit = { text, act -> Button(onClick = { haptics.confirm(); act() }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(text) } }
                    val secondary: @Composable (String, () -> Unit) -> Unit = { text, act -> OutlinedButton(onClick = { haptics.tick(); act() }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) { Text(text) } }
                    when (chosen) {
                        "unclear" -> primary("Name the first tiny step", shrink)
                        "dread" -> {
                            primary("Start for 5 minutes") { sprint(5) }
                            secondary("Name the first tiny step", shrink)
                        }
                        "boring" -> {
                            primary("Start a 10-minute sprint") { sprint(10) }
                            secondary("Do it alongside someone", together)
                        }
                        "energy" -> {
                            DateChoice(day, { day = it }, allowNone = false)
                            Button(onClick = { day?.let { haptics.confirm(); moveTo(it) } ?: haptics.reject() }, enabled = day != null, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Move it to that day") }
                            secondary("Or just 5 minutes now") { sprint(5) }
                        }
                        "waiting" -> {
                            primary("Add “send one message” as the next step") { addStep("Send one message to move it on") }
                            secondary("Mark it as waiting") { setStatus("waiting") }
                        }
                        "pointless" -> primary("Let it go") { setStatus("cancelled") }
                    }
                    TextButton(onClick = { block = null }) { Text("Something else") }
                }
            }
        }
    }
}

/** "What's the smallest first step?" — one small step is enough. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ShrinkItSheet(task: Task, existingSteps: Int, add: (title: String, minutes: Int?) -> Unit, close: () -> Unit) {
    val haptics = rememberHaptics()
    var title by rememberSaveable { mutableStateOf("") }
    var minutes by rememberSaveable { mutableStateOf("5") }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("What's the smallest first step?", style = MaterialTheme.typography.titleLarge)
            Muted(
                "For “${task.title}”. " + if (existingSteps > 0) "$existingSteps ${if (existingSteps == 1) "step is" else "steps are"} already saved. Just add the next one." else "One small step is enough. You can add more later.",
            )
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("First step") }, placeholder = { Text("e.g. Open the file") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            // Scaffolding to get past a blank field, never stored as data.
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                for (starter in listOf("Open the file", "Write one sentence", "Find the phone number", "Gather what I need", "Send one message")) {
                    SelectChip(title == starter, starter, { title = starter })
                }
            }
            OutlinedTextField(value = minutes, onValueChange = { minutes = it.filter(Char::isDigit).take(3) }, label = { Text("Minutes (about)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = MaterialTheme.shapes.medium, modifier = Modifier.width(160.dp))
            Button(
                onClick = { if (title.isBlank()) haptics.reject() else { haptics.confirm(); add(title, minutes.toIntOrNull()?.takeIf { it > 0 }); close() } },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("Add first step") }
        }
    }
}

/* ------------------------------ 1-minute reset ------------------------------ */

private data class Phase(val label: String, val seconds: Int, val scale: Float)
private val PHASES = listOf(Phase("Breathe in", 4, 1f), Phase("Hold", 4, 1f), Phase("Breathe out", 6, 0.55f), Phase("Rest", 2, 0.55f))
private const val ROUNDS = 4

/** Breathe in 4, hold 4, out 6, rest 2; four rounds. A soft tick marks each change so eyes can close. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BreathingSheet(close: () -> Unit) {
    val haptics = rememberHaptics()
    var step by remember { mutableIntStateOf(-1) }
    var left by remember { mutableIntStateOf(PHASES[0].seconds) }
    val done = step >= ROUNDS * PHASES.size
    val phase = if (step < 0) null else PHASES[step % PHASES.size]
    LaunchedEffect(step) {
        if (step < 0 || done) return@LaunchedEffect
        haptics.tick()
        val p = PHASES[step % PHASES.size]
        for (s in p.seconds downTo 1) {
            left = s
            delay(1000)
        }
        step += 1
        if (step >= ROUNDS * PHASES.size) haptics.confirm()
    }
    val target = when {
        phase == null -> 0.55f
        done -> 0.7f
        else -> phase.scale
    }
    val scale by animateFloatAsState(target, tween(durationMillis = (phase?.seconds ?: 1) * 1000), label = "breath")
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("1-minute reset", style = MaterialTheme.typography.titleLarge)
            Muted("Breathe in for 4, hold for 4, out for 6, rest for 2. Four rounds.")
            Spacer(Modifier.height(28.dp))
            Box(Modifier.size(220.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.size(220.dp).scale(scale).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)))
                Box(Modifier.size(150.dp).scale(scale).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.28f)))
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        when {
                            done -> "Done"
                            phase == null -> "Ready"
                            else -> phase.label
                        },
                        style = MaterialTheme.typography.titleLarge,
                    )
                    if (phase != null && !done) Text("$left", style = MaterialTheme.typography.headlineMedium.merge(Numbers))
                }
            }
            Spacer(Modifier.height(28.dp))
            when {
                step < 0 -> Button(onClick = { step = 0 }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Begin") }
                done -> Button(onClick = close, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Back to the day") }
                else -> TextButton(onClick = close) { Text("Stop") }
            }
        }
    }
}

/* ---------------------------- left before payday ---------------------------- */

/**
 * Every line is a real row: the balance logged, the recurring costs set up and
 * the buffer chosen. Costs are projections until logged, so it says so.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoneyBreakdownSheet(totals: BeforePayday, payday: LocalDate, money: MoneyFormatter, close: () -> Unit) {
    val format = DateTimeFormatter.ofPattern("d MMM")
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Left before payday", style = MaterialTheme.typography.titleLarge)
            Muted("Payday ${payday.format(DateTimeFormatter.ofPattern("EEEE d MMMM"))}. Recurring costs count until you log them, so this is an estimate.")
            BreakdownLine("Balance now", money.format(totals.liquid))
            for (item in totals.upcoming) {
                BreakdownLine(
                    "${item.cost.name}${if (item.dates.size > 1) " × ${item.dates.size}" else ""}",
                    "−" + money.format(item.total),
                    item.dates.joinToString(", ") { runCatching { LocalDate.parse(it).format(format) }.getOrDefault(it) },
                )
            }
            if (totals.buffer > 0) BreakdownLine("Buffer you chose", "−" + money.format(totals.buffer))
            androidx.compose.material3.HorizontalDivider()
            BreakdownLine(if (totals.available >= 0) "Left to spend" else "Short by", money.format(kotlin.math.abs(totals.available)), bold = true)
        }
    }
}

@Composable
private fun BreakdownLine(label: String, value: String, detail: String? = null, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) {
            Text(label, style = if (bold) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge)
            detail?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
        }
        Text(value, style = (if (bold) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge).merge(Numbers))
    }
}
