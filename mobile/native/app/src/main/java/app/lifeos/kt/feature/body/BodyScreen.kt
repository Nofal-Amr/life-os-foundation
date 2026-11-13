package app.lifeos.kt.feature.body

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Bedtime
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.MonitorWeight
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WaterDrop
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.common.instantOf
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LocalStatusBarHandled
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.NotEnoughData
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.PickDate
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.TrendLine
import app.lifeos.kt.core.designsystem.LifeTheme
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.data.logic.SCALE_ENDS
import app.lifeos.kt.data.logic.bmi
import app.lifeos.kt.data.logic.formatDuration
import app.lifeos.kt.data.logic.scaleTone
import app.lifeos.kt.data.logic.sleepScoreSeries
import app.lifeos.kt.data.logic.sleepSeries
import app.lifeos.kt.data.logic.weightToDisplay
import app.lifeos.kt.data.logic.weightToStored
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

private val PAGES = listOf(
    "Day" to "Log your day in a few taps. Anything you skip stays empty.",
    "Meals" to "Tap what you had; the meal follows the time of day.",
    "Medication" to "Your own schedule and a taken checklist. No dosing guidance.",
    "Trends" to "Sleep and weight, from what you logged.",
)

/**
 * Body: the web's Health and Food pages as four tabs. A day bar sets which
 * day the first three tabs log for; every change saves as it's made.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BodyScreen(model: BodyViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val pager = rememberPagerState { PAGES.size }
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    val scope = rememberCoroutineScope()
    var adding by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(pager) {
        var first = true
        snapshotFlow { pager.settledPage }.collect { 
            // A field left focused on one tab would keep the keyboard up on the next.
            focus.clearFocus()
            if (first) first = false else haptics.tick()
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            val top = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
            Row(top.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Body", style = MaterialTheme.typography.headlineLarge)
                    Muted(PAGES[pager.currentPage].second)
                }
                SyncAction()
            }
            PrimaryScrollableTabRow(selectedTabIndex = pager.currentPage, edgePadding = 12.dp, containerColor = MaterialTheme.colorScheme.background, divider = {}) {
                PAGES.forEachIndexed { index, (label, _) ->
                    Tab(
                        selected = pager.currentPage == index,
                        onClick = { scope.launch { pager.animateScrollToPage(index) } },
                        text = { Text(label, style = MaterialTheme.typography.labelLarge) },
                        selectedContentColor = MaterialTheme.colorScheme.primary,
                        unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            state?.let { s -> AnimatedVisibility(pager.currentPage < 3) { DayBar(s, model) } }
            HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1) { page ->
                val s = state
                BodyList {
                    if (s == null) {
                        items(4) { Skeleton(height = 80.dp) }
                        return@BodyList
                    }
                    when (page) {
                        0 -> dayPage(s, model) { scope.launch { pager.animateScrollToPage(it) } }
                        1 -> mealsPage(s, model)
                        2 -> medicationPage(s, model)
                        else -> trendsPage(s, model)
                    }
                }
            }
        }
        val label = when (pager.currentPage) { 1 -> "Food"; 2 -> "Medication"; 3 -> "Weight"; else -> null }
        if (label != null && state != null) {
            ExtendedFloatingActionButton(
                onClick = { haptics.tick(); adding = label },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text(label) },
                modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
            )
        }
    }

    val s = state ?: return
    when (adding) {
        "Food" -> FoodEditor(model, null, close = { adding = null })
        "Medication" -> MedicationEditor(s, model, null, close = { adding = null })
        "Weight" -> WeightSheet(s, model, close = { adding = null })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BodyList(content: LazyListScope.() -> Unit) {
    val sync = LocalSyncStatus.current
    PullToRefreshBox(isRefreshing = sync.state.running, onRefresh = sync.syncNow, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 112.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun DayBar(s: BodyState, model: BodyViewModel) = app.lifeos.kt.core.designsystem.DayBar(s.date, s.today, model::setDate)

/* --------------------------------- Day --------------------------------- */

private fun LazyListScope.dayPage(s: BodyState, model: BodyViewModel, goTo: (Int) -> Unit) {
    if (s.healthHabits.isNotEmpty()) item(key = "habits") { HealthHabits(s, model) }
    item(key = "quick") { QuickLog(s, model) }
    item(key = "more") { MoreFields(s, model) }
    item(key = "note") { NoteField(s, model) }
    item(key = "doses") { DoseStrip(s, model, onManage = { goTo(2) }) }
    item(key = "recent-head") { SectionHeader("Recent days") }
    val recent = s.logs.filter { it.logDate != s.iso }.take(7)
    if (recent.isEmpty()) {
        item(key = "recent-empty") { LifeCard { Muted("A daily log keeps a record of how you felt and slept, in your own words and numbers.") } }
    } else {
        item(key = "recent") {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                recent.forEachIndexed { index, log ->
                    if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    RecentDay(s, log) { model.setDate(LocalDate.parse(log.logDate)) }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HealthHabits(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    LifeCard {
        Eyebrow("Health habits")
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (habit in s.healthHabits) {
                val done = s.habitLogs.any { it.habitId == habit.id && it.logDate == s.iso }
                SelectChip(done, habit.name, { if (done) haptics.tick() else haptics.confirm(); model.toggleHabit(s, habit) })
            }
        }
    }
}

/** The four things most days need: two tiles, a sleep stepper and a mood scale. */
@Composable
private fun QuickLog(s: BodyState, model: BodyViewModel) {
    val log = s.log
    LifeCard {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ToggleTile("Trained", Icons.Outlined.FitnessCenter, log?.trained == true, Modifier.weight(1f)) { on -> model.updateLog(s) { it.copy(trained = on) } }
            ToggleTile("Water target met", Icons.Outlined.WaterDrop, log?.waterOk == true, Modifier.weight(1f)) { on -> model.updateLog(s) { it.copy(waterOk = on) } }
        }
        Spacer(Modifier.height(18.dp))
        SleepStepper(log?.sleepMinutes) { minutes -> model.updateLog(s) { it.copy(actualSleepMinutes = minutes, sleepHours = minutes?.let { m -> Math.round(m / 6.0) / 10.0 }) } }
        Spacer(Modifier.height(18.dp))
        ScaleRow("Mood", "mood", log?.mood) { v -> model.updateLog(s) { it.copy(mood = v) } }
    }
}

@Composable
private fun ToggleTile(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, on: Boolean, modifier: Modifier, set: (Boolean) -> Unit) {
    val haptics = rememberHaptics()
    val bg by animateColorAsState(if (on) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface, label = "tile")
    val fg by animateColorAsState(if (on) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant, label = "tileText")
    Column(
        modifier
            .clip(MaterialTheme.shapes.large)
            .background(bg)
            .border(1.dp, if (on) Color.Transparent else MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.large)
            .clickable { if (on) haptics.tick() else haptics.confirm(); set(!on) }
            .padding(14.dp),
    ) {
        Icon(icon, null, tint = if (on) MaterialTheme.colorScheme.primary else fg)
        Spacer(Modifier.height(10.dp))
        Text(label, style = MaterialTheme.typography.titleSmall, color = fg)
        Text(if (on) "Yes" else "Not yet", style = MaterialTheme.typography.bodySmall, color = fg.copy(alpha = 0.75f))
    }
}

/** Sleep in 15-minute steps: − and +, a first + starts at 7 hours. Tap the figure to clear it. */
@Composable
private fun SleepStepper(minutes: Int?, set: (Int?) -> Unit) {
    val haptics = rememberHaptics()
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconBadge(Icons.Outlined.Bedtime, size = 36.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Eyebrow("Sleep time")
            Text(
                if (minutes == null) "Not logged" else formatDuration(minutes),
                style = MaterialTheme.typography.titleLarge.merge(Numbers),
                color = if (minutes == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.clip(MaterialTheme.shapes.small).clickable(enabled = minutes != null) { haptics.tick(); set(null) },
            )
        }
        FilledTonalIconButton(onClick = { haptics.tick(); set(((minutes ?: 435) - 15).coerceAtLeast(0)) }) { Text("−", style = MaterialTheme.typography.titleLarge) }
        Spacer(Modifier.width(8.dp))
        FilledTonalIconButton(onClick = { haptics.tick(); set(if (minutes == null) 420 else (minutes + 15).coerceAtMost(24 * 60)) }) { Text("+", style = MaterialTheme.typography.titleLarge) }
    }
}

/** 1 to 5, tinted by what the number means; tap the chosen one again to clear it. */
@Composable
internal fun ScaleRow(label: String, kind: String, value: Int?, set: (Int?) -> Unit) {
    val haptics = rememberHaptics()
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(label)
            if (value != null) {
                Spacer(Modifier.width(8.dp))
                Text("$value of 5", style = MaterialTheme.typography.labelMedium, color = toneColor(scaleTone(kind, value)))
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (level in 1..5) {
                val selected = value == level
                val tone = toneColor(scaleTone(kind, level))
                val bg by animateColorAsState(if (selected) tone.copy(alpha = 0.18f) else Color.Transparent, label = "scale")
                Box(
                    Modifier
                        .weight(1f)
                        .height(48.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .background(bg)
                        .border(if (selected) 2.dp else 1.dp, if (selected) tone else MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium)
                        .clickable { haptics.tick(); set(if (selected) null else level) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("$level", style = MaterialTheme.typography.titleMedium.merge(Numbers), color = if (selected) tone else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        val (low, high) = SCALE_ENDS.getValue(kind)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            Muted(low, style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
            Muted(high, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
internal fun toneColor(tone: String): Color = when (tone) {
    "danger" -> MaterialTheme.colorScheme.error
    "warning" -> LifeTheme.colors.entity.getValue("amber")
    "positive" -> LifeTheme.colors.entity.getValue("green")
    else -> MaterialTheme.colorScheme.primary
}

/** Everything else the web's "More fields" holds, folded away until wanted. */
@Composable
private fun MoreFields(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    val log = s.log
    val filled = log?.let { l -> listOf(l.sleepScore, l.stressLevel, l.foodQuality, l.timeInBedMinutes, l.deepSleepMinutes, l.remSleepMinutes, l.lightSleepMinutes, l.awakeMinutes, l.sleepLatencyMinutes, l.bloodOxygenAvg, l.heartRateAvg, l.respiratoryRateAvg, l.sleepStartAt, l.sleepEndAt, l.sleepSource).count { it != null } } ?: 0
    var open by rememberSaveable { mutableStateOf(false) }
    LifeCard(onClick = { open = !open }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (open) "Fewer fields" else "More fields", style = MaterialTheme.typography.titleSmall)
                Muted(if (filled == 0) "Sleep score, stress, food, sleep stages, vitals" else "$filled filled in", style = MaterialTheme.typography.bodySmall)
            }
            Icon(if (open) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null, modifier = Modifier.size(22.dp))
        }
        AnimatedVisibility(open) {
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                IntField("Sleep score", log?.sleepScore, "of 100") { v -> model.updateLog(s) { it.copy(sleepScore = v?.coerceIn(0, 100)) } }
                ScaleRow("Stress", "stress", log?.stressLevel) { v -> model.updateLog(s) { it.copy(stressLevel = v) } }
                ScaleRow("Food quality", "food", log?.foodQuality) { v -> model.updateLog(s) { it.copy(foodQuality = v) } }
                DurationField("Time in bed", log?.timeInBedMinutes) { v -> model.updateLog(s) { it.copy(timeInBedMinutes = v) } }
                DurationField("Deep sleep", log?.deepSleepMinutes) { v -> model.updateLog(s) { it.copy(deepSleepMinutes = v) } }
                DurationField("REM sleep", log?.remSleepMinutes) { v -> model.updateLog(s) { it.copy(remSleepMinutes = v) } }
                DurationField("Light sleep", log?.lightSleepMinutes) { v -> model.updateLog(s) { it.copy(lightSleepMinutes = v) } }
                DurationField("Awake", log?.awakeMinutes) { v -> model.updateLog(s) { it.copy(awakeMinutes = v) } }
                DurationField("Time to fall asleep", log?.sleepLatencyMinutes) { v -> model.updateLog(s) { it.copy(sleepLatencyMinutes = v) } }
                DecimalField("Blood oxygen average", log?.bloodOxygenAvg, "%") { v -> model.updateLog(s) { it.copy(bloodOxygenAvg = v) } }
                DecimalField("Heart rate average", log?.heartRateAvg, "bpm") { v -> model.updateLog(s) { it.copy(heartRateAvg = v) } }
                DecimalField("Respiratory rate average", log?.respiratoryRateAvg, "per min") { v -> model.updateLog(s) { it.copy(respiratoryRateAvg = v) } }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TimeChip("Sleep started", log?.sleepStartAt, s, Modifier.weight(1f)) { iso -> model.updateLog(s) { it.copy(sleepStartAt = iso) } }
                    TimeChip("Sleep ended", log?.sleepEndAt, s, Modifier.weight(1f)) { iso -> model.updateLog(s) { it.copy(sleepEndAt = iso) } }
                }
                TextSetting("Measured with", log?.sleepSource, "Device name, if you want to record it") { v -> model.updateLog(s) { it.copy(sleepSource = v) } }
                TextButton(onClick = { haptics.tick(); open = false }) { Text("Fewer fields") }
            }
        }
    }
}

/** A field that saves itself a moment after typing stops; the stored value only changes on a real number. */
@Composable
private fun DebouncedField(label: String, initial: String, suffix: String?, keyboard: KeyboardType, modifier: Modifier = Modifier, placeholder: String? = null, save: (String) -> Unit) {
    var text by remember(initial) { mutableStateOf(initial) }
    var dirty by remember { mutableStateOf(false) }
    LaunchedEffect(text) {
        if (!dirty) return@LaunchedEffect
        delay(600)
        save(text)
        dirty = false
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it; dirty = true },
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        suffix = suffix?.let { { Text(it) } },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(Numbers),
        shape = MaterialTheme.shapes.medium,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        modifier = modifier.fillMaxWidth(),
    )
}

@Composable
private fun IntField(label: String, value: Int?, suffix: String?, set: (Int?) -> Unit) =
    DebouncedField(label, value?.toString().orEmpty(), suffix, KeyboardType.Number) { set(it.trim().toIntOrNull()) }

@Composable
private fun DecimalField(label: String, value: Double?, suffix: String?, set: (Double?) -> Unit) =
    DebouncedField(label, value?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }.orEmpty(), suffix, KeyboardType.Decimal) { set(it.trim().replace(',', '.').toDoubleOrNull()) }

@Composable
private fun TextSetting(label: String, value: String?, placeholder: String, set: (String?) -> Unit) =
    DebouncedField(label, value.orEmpty(), null, KeyboardType.Text, placeholder = placeholder) { set(it.trim().ifEmpty { null }) }

/** Hours and minutes typed separately, stored as minutes. */
@Composable
private fun DurationField(label: String, minutes: Int?, set: (Int?) -> Unit) {
    Column {
        Eyebrow(label)
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val h = minutes?.div(60)
            val m = minutes?.rem(60)
            DebouncedField("Hours", h?.toString().orEmpty(), "h", KeyboardType.Number, Modifier.weight(1f)) { text ->
                val hours = text.trim().toIntOrNull()
                set(if (hours == null && m == null) null else (hours ?: 0) * 60 + (m ?: 0))
            }
            DebouncedField("Minutes", m?.toString().orEmpty(), "m", KeyboardType.Number, Modifier.weight(1f)) { text ->
                val mins = text.trim().toIntOrNull()?.coerceIn(0, 59)
                set(if (mins == null && h == null) null else (h ?: 0) * 60 + (mins ?: 0))
            }
        }
    }
}

/** A clock time on the day being logged, stored as a timestamp like the web does. Long-press clears it. */
@Composable
private fun TimeChip(label: String, iso: String?, s: BodyState, modifier: Modifier, set: (String?) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    val time = instantOf(iso)?.atZone(ZoneId.systemDefault())?.toLocalTime()
    Column(modifier) {
        Eyebrow(label)
        Spacer(Modifier.height(6.dp))
        SelectChip(time != null, time?.let { s.slot(it.toString().take(5)) } ?: "Set a time", { picking = true }, leadingIcon = Icons.Outlined.Schedule)
        if (time != null) TextButton(onClick = { set(null) }, contentPadding = PaddingValues(horizontal = 4.dp)) { Text("Clear") }
    }
    if (picking) {
        PickTime(time ?: LocalTime.of(23, 0), dismiss = { picking = false }) {
            set(s.date.atTime(it).atZone(ZoneId.systemDefault()).toInstant().toString())
        }
    }
}

@Composable
private fun NoteField(s: BodyState, model: BodyViewModel) {
    var text by remember(s.iso, s.log?.id) { mutableStateOf(s.log?.note.orEmpty()) }
    var dirty by remember(s.iso) { mutableStateOf(false) }
    LaunchedEffect(text) {
        if (!dirty) return@LaunchedEffect
        delay(700)
        model.updateLog(s) { it.copy(note = text.trim().ifEmpty { null }) }
        dirty = false
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it; dirty = true },
        label = { Text("Note") },
        placeholder = { Text("Anything about today, in your words") },
        minLines = 2,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun RecentDay(s: BodyState, log: HealthLog, open: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = open).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(friendlyDate(log.logDate, s.today) ?: log.logDate, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(112.dp))
        Muted(
            listOfNotNull(
                "Trained".takeIf { log.trained == true },
                log.sleepMinutes?.let { "${formatDuration(it)} sleep" },
                log.sleepScore?.let { "Score $it" },
                log.mood?.let { "Mood $it of 5" },
                log.stressLevel?.let { "Stress $it of 5" },
            ).joinToString(" · ").ifEmpty { "Note only" },
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
    }
}

/* -------------------------------- Trends -------------------------------- */

private fun LazyListScope.trendsPage(s: BodyState, model: BodyViewModel) {
    item(key = "range") { TrendsBody(s, model) }
}

@Composable
private fun TrendsBody(s: BodyState, model: BodyViewModel) {
    val haptics = rememberHaptics()
    var days by rememberSaveable { mutableIntStateOf(30) }
    val from = s.today.minusDays((days - 1).toLong())
    val hours = sleepSeries(s.logs, days, s.today)
    val scores = sleepScoreSeries(s.logs, days, s.today)
    var weighing by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf(14, 30).forEachIndexed { index, d ->
                SegmentedButton(selected = days == d, onClick = { haptics.tick(); days = d }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text("$d days") }
            }
        }
        LifeCard {
            Eyebrow("Sleep hours")
            Muted("${hours.size} ${if (hours.size == 1) "entry" else "entries"} in $days days", style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(10.dp))
            if (hours.size < 2) NotEnoughData("Log sleep hours on at least two days.")
            else TrendLine(hours, from, s.today, { formatDuration((it * 60).roundToInt()) }, color = LifeTheme.colors.chart[0])
        }
        LifeCard {
            Eyebrow("Sleep score")
            Muted("${scores.size} ${if (scores.size == 1) "entry" else "entries"} in $days days", style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(10.dp))
            if (scores.size < 2) NotEnoughData("Enter a sleep score on at least two days.")
            else TrendLine(scores, from, s.today, { it.toInt().toString() }, color = LifeTheme.colors.chart[4])
        }
        WeightCard(s) { weighing = true }
    }
    if (weighing) WeightSheet(s, model, close = { weighing = false })
}

@Composable
private fun WeightCard(s: BodyState, edit: () -> Unit) {
    val stats = s.stats
    val unit = if (s.imperial) "lb" else "kg"
    val shown = weightToDisplay(stats?.weightKg, s.imperial)
    val value = bmi(stats?.heightCm, stats?.weightKg)
    LifeCard(onClick = edit) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBadge(Icons.Outlined.MonitorWeight, size = 36.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Eyebrow("Weight")
                Text(shown?.let { "${trim(it)} $unit" } ?: "—", style = MaterialTheme.typography.titleLarge.merge(Numbers))
            }
            if (value != null) {
                Column(horizontalAlignment = Alignment.End) {
                    Eyebrow("BMI")
                    Text(String.format(java.util.Locale.getDefault(), "%.1f", value), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        val saved = stats?.updatedAt?.let { friendlyDate(it.take(10), s.today) }
        Muted(
            when {
                shown == null -> "No weight saved yet. Tap to add it."
                value != null -> "Saved ${saved ?: "earlier"}. BMI is weight in kg ÷ height in m², from ${trim(stats!!.heightCm!!)} cm. Only the latest weight is stored, so there is no trend to draw."
                else -> "Saved ${saved ?: "earlier"}. Add your height to see your BMI. Only the latest weight is stored, so there is no trend to draw."
            },
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

private fun trim(value: Double) = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

@Composable
private fun WeightSheet(s: BodyState, model: BodyViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val unit = if (s.imperial) "lb" else "kg"
    var weight by rememberSaveable { mutableStateOf(weightToDisplay(s.stats?.weightKg, s.imperial)?.let(::trim).orEmpty()) }
    var height by rememberSaveable { mutableStateOf(s.stats?.heightCm?.let(::trim).orEmpty()) }
    app.lifeos.kt.feature.tasks.EditorSheet(
        title = "Weight",
        close = close,
        onSave = {
            val w = weight.trim().replace(',', '.').toDoubleOrNull()
            val h = height.trim().replace(',', '.').toDoubleOrNull()
            if ((weight.isNotBlank() && (w == null || w <= 0)) || (height.isNotBlank() && (h == null || h < 50 || h > 260))) { haptics.reject(); false } else {
                haptics.confirm()
                model.saveWeight(s, weightToStored(w, s.imperial))
                if (h != s.stats?.heightCm) model.saveHeight(s, h)
                true
            }
        },
    ) {
        OutlinedTextField(weight, { weight = it }, label = { Text("Current weight") }, suffix = { Text(unit) }, singleLine = true, textStyle = MaterialTheme.typography.headlineSmall.merge(Numbers), shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(height, { height = it }, label = { Text("Height") }, suffix = { Text("cm") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
        Muted("Only the latest weight is kept. Height is used for BMI and nothing else.", style = MaterialTheme.typography.bodySmall)
    }
}
