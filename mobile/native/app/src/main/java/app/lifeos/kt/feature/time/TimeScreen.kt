package app.lifeos.kt.feature.time

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.designsystem.BarChart
import app.lifeos.kt.core.designsystem.EntityIcon
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IdentityPicker
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Activity
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.TimerRepository
import app.lifeos.kt.data.logic.daysEnding
import app.lifeos.kt.data.logic.entryDay
import app.lifeos.kt.data.logic.entryMinutes
import app.lifeos.kt.data.logic.formatClock
import app.lifeos.kt.data.logic.formatMinutes
import app.lifeos.kt.data.logic.minutesByDay
import app.lifeos.kt.data.logic.minutesByKey
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class TimeState(val entries: List<TimeEntry>, val activities: List<Activity>, val tasks: List<Task>, val running: TimeEntry?)

@HiltViewModel
class TimeViewModel @Inject constructor(private val timer: TimerRepository, tasks: TaskRepository) : ViewModel() {
    val state: StateFlow<TimeState?> = combine(timer.entries, timer.activities, tasks.tasks) { e, a, t ->
        TimeState(e, a.filter { !it.archived }.sortedBy { it.position }, t, e.filter { it.endedAt == null }.maxByOrNull { it.startedAt })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun start(activity: Activity, s: TimeState) = viewModelScope.launch { timer.startActivity(activity, s.entries) }
    fun start(task: Task, s: TimeState) = viewModelScope.launch { timer.start(task.id, task.title, s.entries) }
    fun stop(entry: TimeEntry) = viewModelScope.launch { timer.stop(entry) }
    fun log(label: String, activityId: String?, minutes: Int, endedAt: Instant, note: String?) = viewModelScope.launch { timer.log(label, activityId, null, minutes, endedAt, note) }
    fun delete(entry: TimeEntry) = viewModelScope.launch { timer.delete(entry) }
    fun restore(entry: TimeEntry) = viewModelScope.launch { timer.restore(entry) }
    fun save(activity: Activity) = viewModelScope.launch { timer.save(activity) }
    fun starters(s: TimeState) = viewModelScope.launch { timer.addStarterActivities(s.activities) }
}

/** Time: start a timer for anything, or log it afterwards; where the week's time went. */
@OptIn(ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)
@Composable
fun TimeScreen(back: @Composable () -> Unit, model: TimeViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var logging by rememberSaveable { mutableStateOf(false) }
    var adding by rememberSaveable { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(state?.running?.id) { while (state?.running != null) { now = System.currentTimeMillis(); delay(1_000) } }
    val s = state
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now()

    LifePage(
        title = "Time",
        subtitle = "Start a timer for anything you do, or log it afterwards.",
        navigationIcon = back,
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = { haptics.tick(); logging = true }, icon = { Icon(Icons.Outlined.Add, null) }, text = { Text("Log time") })
        },
    ) {
        if (s == null) return@LifePage
        item(key = "running") {
            AnimatedVisibility(s.running != null) {
                val entry = s.running ?: return@AnimatedVisibility
                LifeCard(color = MaterialTheme.colorScheme.primaryContainer) {
                    Eyebrow("Running", color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(entry.label ?: "Timer", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    val started = runCatching { Instant.parse(entry.startedAt).toEpochMilli() }.getOrDefault(now)
                    Text(formatClock(now - started), style = MaterialTheme.typography.displaySmall.merge(Numbers), color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { haptics.confirm(); model.stop(entry) }, shape = MaterialTheme.shapes.medium) {
                        Icon(Icons.Outlined.Stop, null)
                        Spacer(Modifier.width(6.dp))
                        Text("Stop")
                    }
                }
            }
        }
        item(key = "start-h") { SectionHeader("Start a timer", action = "New activity", onAction = { adding = true }) }
        item(key = "start") {
            LifeCard {
                if (s.activities.isEmpty()) {
                    Muted("Activities are the things you time: reading, gaming, learning…")
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(onClick = { haptics.tick(); model.starters(s) }, shape = MaterialTheme.shapes.medium) { Text("Add six to start with") }
                } else {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (activity in s.activities) {
                            val on = s.running?.activityId == activity.id
                            FilledTonalButton(onClick = { haptics.confirm(); if (on) s.running?.let(model::stop) else model.start(activity, s) }, shape = MaterialTheme.shapes.medium, contentPadding = PaddingValues(start = 8.dp, end = 14.dp)) {
                                EntityIcon(activity.icon, activity.color, fallback = Icons.Outlined.Timer, size = 26.dp)
                                Spacer(Modifier.width(8.dp))
                                Text(activity.name)
                                if (on) { Spacer(Modifier.width(6.dp)); Icon(Icons.Outlined.Stop, "Stop") }
                            }
                        }
                    }
                }
            }
        }
        val todays = s.tasks.filter { it.status != "completed" && it.status != "cancelled" && it.parentTaskId == null && (it.dueDate?.take(10) ?: "9") <= today.toString() }.take(5)
        if (todays.isNotEmpty()) {
            item(key = "tasks-h") { SectionHeader("Tasks to work on") }
            item(key = "tasks") {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    for (task in todays) {
                        val on = s.running?.taskId == task.id
                        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(task.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, modifier = Modifier.weight(1f))
                            IconButton(onClick = { haptics.confirm(); if (on) s.running?.let(model::stop) else model.start(task, s) }) {
                                Icon(if (on) Icons.Outlined.Stop else Icons.Outlined.PlayArrow, if (on) "Stop" else "Start timing ${task.title}")
                            }
                        }
                    }
                }
            }
        }

        val week = daysEnding(today, 7)
        val perDay = minutesByDay(s.entries, week, now, zone)
        item(key = "week-h") { SectionHeader("Last 7 days") }
        item(key = "week") {
            LifeCard {
                if (perDay.sum() == 0) Muted("Nothing timed in the last 7 days.")
                else {
                    Text(formatMinutes(perDay.sum()), style = MaterialTheme.typography.headlineSmall.merge(Numbers))
                    Muted("in the last 7 days", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(10.dp))
                    BarChart(week.zip(perDay).map { (d, m) -> d.format(DateTimeFormatter.ofPattern("EEE")) to m.toDouble() }, { formatMinutes(it.toInt()) })
                    Spacer(Modifier.height(12.dp))
                    for ((key, minutes) in minutesByKey(s.entries, week, now, zone).take(6)) {
                        val label = labelFor(key, s)
                        Row(Modifier.padding(vertical = 3.dp)) {
                            Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1)
                            Text(formatMinutes(minutes), style = MaterialTheme.typography.bodyMedium.merge(Numbers))
                        }
                    }
                }
            }
        }

        val todayEntries = s.entries.filter { entryDay(it, zone) == today }.sortedByDescending { it.startedAt }
        item(key = "today-h") { SectionHeader("Today") }
        item(key = "today") {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                if (todayEntries.isEmpty()) Muted("Nothing timed today yet.", Modifier.padding(16.dp))
                for (entry in todayEntries) {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                            Text(entry.label ?: "Timer", style = MaterialTheme.typography.bodyLarge, maxLines = 1)
                            val start = runCatching { Instant.parse(entry.startedAt).atZone(zone).toLocalTime() }.getOrNull()
                            Muted(listOfNotNull(start?.format(DateTimeFormatter.ofPattern("HH:mm")), formatMinutes(entryMinutes(entry, now)), entry.note).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                        }
                        if (entry.endedAt != null) IconButton(onClick = { haptics.tick(); model.delete(entry); undo("Removed") { model.restore(entry) } }) {
                            Icon(Icons.Outlined.DeleteOutline, "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }

    if (logging && s != null) LogSheet(s.activities, close = { logging = false }) { label, id, minutes, end, note -> model.log(label, id, minutes, end, note) }
    if (adding) ActivitySheet(close = { adding = false }) { model.save(it) }
}

private fun labelFor(key: String, s: TimeState): String = when {
    key.startsWith("a:") -> s.activities.firstOrNull { it.id == key.drop(2) }?.name ?: s.entries.firstOrNull { it.activityId == key.drop(2) }?.label ?: "Activity"
    key.startsWith("t:") -> s.tasks.firstOrNull { it.id == key.drop(2) }?.title ?: "Task"
    else -> key.drop(2).ifEmpty { "Timer" }
}

/** Time done earlier: what, how long, when it finished, a note. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LogSheet(activities: List<Activity>, close: () -> Unit, save: (String, String?, Int, Instant, String?) -> Unit) {
    val haptics = rememberHaptics()
    var activity by rememberSaveable { mutableStateOf(activities.firstOrNull()?.id) }
    var label by rememberSaveable { mutableStateOf("") }
    var minutes by rememberSaveable { mutableStateOf("30") }
    var ended by rememberSaveable { mutableStateOf(LocalTime.now().withSecond(0).withNano(0).toString()) }
    var note by rememberSaveable { mutableStateOf("") }
    var picking by rememberSaveable { mutableStateOf(false) }
    app.lifeos.kt.feature.tasks.EditorSheet(title = "Log time", close = close, onSave = {
        val m = minutes.toIntOrNull()
        val chosen = activities.firstOrNull { it.id == activity }
        val name = chosen?.name ?: label.trim()
        if (m == null || m !in 1..1440 || name.isEmpty()) { haptics.reject(); false } else {
            haptics.confirm()
            val end = LocalTime.parse(ended).atDate(LocalDate.now()).atZone(ZoneId.systemDefault()).toInstant().let { if (it.isAfter(Instant.now())) it.minusSeconds(86_400) else it }
            save(name, chosen?.id, m, end, note)
            true
        }
    }) {
        if (activities.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (a in activities) SelectChip(activity == a.id, a.name, { haptics.tick(); activity = a.id })
            SelectChip(activity == null, "Something else", { haptics.tick(); activity = null })
        }
        if (activity == null) OutlinedTextField(label, { label = it }, label = { Text("What was it?") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(minutes, { minutes = it.filter(Char::isDigit).take(4) }, label = { Text("Minutes") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { for (m in listOf(15, 30, 45, 60, 90, 120)) SelectChip(minutes == "$m", formatMinutes(m), { haptics.tick(); minutes = "$m" }) }
        OutlinedButton(onClick = { picking = true }, shape = MaterialTheme.shapes.medium) { Text("Finished at $ended") }
        OutlinedTextField(note, { note = it }, label = { Text("Note (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
    }
    if (picking) PickTime(LocalTime.parse(ended), { picking = false }) { ended = it.toString(); picking = false }
}

@Composable
private fun ActivitySheet(close: () -> Unit, save: (Activity) -> Unit) {
    val haptics = rememberHaptics()
    var name by rememberSaveable { mutableStateOf("") }
    var icon by rememberSaveable { mutableStateOf<String?>(null) }
    var color by rememberSaveable { mutableStateOf<String?>(null) }
    app.lifeos.kt.feature.tasks.EditorSheet(title = "New activity", close = close, onSave = {
        if (name.isBlank()) { haptics.reject(); false } else { haptics.confirm(); save(Activity(newId(), name.trim(), icon, color)); true }
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
    }
}
