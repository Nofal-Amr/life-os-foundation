package app.lifeos.kt.feature.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Alarm
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.common.instantOf
import app.lifeos.kt.core.common.localDateOf
import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.designsystem.PickDate
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.isOpen
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.text.DateFormat
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Date
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ToolsState(
    val tasks: List<Task>,
    val events: List<CalendarEvent>,
    val reminders: List<Reminder>,
    val notes: List<Note>,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
    val projects: List<Project>,
    val goals: List<Goal>,
)

@HiltViewModel
class ToolsViewModel @Inject constructor(
    tasks: TaskRepository,
    private val planner: PlannerRepository,
    private val plan: PlanRepository,
) : ViewModel() {
    private val plannerFlow = combine(planner.events, planner.reminders, planner.notes) { e, r, n -> Triple(e, r, n) }
    private val planFlow = combine(plan.habits, plan.habitLogs, plan.projects, plan.goals) { h, l, p, g -> listOf(h, l, p, g) }

    @Suppress("UNCHECKED_CAST")
    val state: StateFlow<ToolsState?> = combine(tasks.tasks, plannerFlow, planFlow) { t, (e, r, n), p ->
        ToolsState(t, e, r, n, p[0] as List<Habit>, p[1] as List<HabitLog>, p[2] as List<Project>, p[3] as List<Goal>)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun toggleHabit(habit: Habit) = viewModelScope.launch {
        state.value?.let { plan.toggleHabit(habit, LocalDate.now().toString(), it.habitLogs) }
    }
    fun saveReminder(reminder: Reminder) = viewModelScope.launch { planner.save(reminder) }
}

private val clock: DateFormat get() = DateFormat.getTimeInstance(DateFormat.SHORT)
private fun timeOf(timestamp: String?): String? = instantOf(timestamp)?.let { clock.format(Date.from(it)) }

/* ------------------------------- Calendar ------------------------------- */

private data class Entry(val time: String?, val title: String, val kind: String, val icon: ImageVector)

/** The next two weeks, day by day: events, tasks due and reminders. */
@Composable
fun CalendarTool(back: @Composable () -> Unit, model: ToolsViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    LifePage(title = "Calendar", navigationIcon = back) {
        val s = state ?: run { items(4) { Skeleton() }; return@LifePage }
        val today = LocalDate.now()
        val days = (0L until 14L).map { today.plusDays(it) }
        val byDay = days.associateWith { mutableListOf<Entry>() }
        s.events.forEach { e -> localDateOf(e.startAt)?.let { byDay[it]?.add(Entry(timeOf(e.startAt), e.title, "Event", Icons.Outlined.Event)) } }
        s.tasks.filter { it.isOpen() && it.parentTaskId == null }.forEach { t ->
            val day = t.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@forEach
            byDay[if (day < today) today else day]?.add(Entry(t.dueTime?.take(5), t.title, if (day < today) "Task, from ${friendlyDate(day)}" else "Task", Icons.Outlined.TaskAlt))
        }
        s.reminders.filter { it.doneAt == null || it.repeat != "none" }.forEach { r ->
            localDateOf(r.remindAt)?.let { byDay[it]?.add(Entry(timeOf(r.remindAt), r.title, "Reminder", Icons.Outlined.Alarm)) }
        }
        val shown = days.filter { it == today || byDay.getValue(it).isNotEmpty() }
        if (shown.size == 1 && byDay.getValue(today).isEmpty()) {
            item { EmptyState(Icons.Outlined.Event, "Nothing in the next two weeks", "Tasks with dates, events and reminders show here, day by day.") }
            return@LifePage
        }
        for (day in shown) {
            val entries = byDay.getValue(day).sortedBy { it.time ?: "99" }
            item(key = day.toString()) {
                SectionHeader(if (day == today) "Today" else if (day == today.plusDays(1)) "Tomorrow" else day.format(DateTimeFormatter.ofPattern("EEEE d MMM")))
            }
            item(key = "$day-items") {
                if (entries.isEmpty()) {
                    Muted("Nothing planned", Modifier.padding(start = 4.dp))
                } else {
                    LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                        for (entry in entries) {
                            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                IconBadge(entry.icon, size = 32.dp)
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(entry.title, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Muted(entry.kind, style = MaterialTheme.typography.bodySmall)
                                }
                                entry.time?.let { Text(it, style = MaterialTheme.typography.labelLarge) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* -------------------------------- Habits -------------------------------- */

/** Active habits: tap to mark today, tap again to undo. Weekly ones show this week's count. */
@Composable
fun HabitsTool(back: @Composable () -> Unit, model: ToolsViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    LifePage(title = "Habits", navigationIcon = back) {
        val s = state ?: run { items(4) { Skeleton(height = 64.dp) }; return@LifePage }
        val today = LocalDate.now().toString()
        val weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()
        val active = s.habits.filter { it.active }.sortedBy { it.name.lowercase() }
        if (active.isEmpty()) item { EmptyState(Icons.Outlined.Repeat, "No habits yet", "Add habits on the website for now; you can mark them here, offline too.") }
        items(active, key = { it.id }) { habit ->
            val done = s.habitLogs.any { it.habitId == habit.id && it.logDate == today }
            val thisWeek = s.habitLogs.count { it.habitId == habit.id && it.logDate >= weekStart }
            LifeCard(Modifier.animateItem(), onClick = { if (!done) haptics.confirm(); model.toggleHabit(habit) }, color = if (done) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (done) Icons.Filled.CheckCircle else Icons.Outlined.Circle, null, tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(habit.name, style = MaterialTheme.typography.bodyLarge)
                        Muted(if (habit.frequency == "weekly") "$thisWeek of ${habit.target} this week" else if (done) "Done today" else "Today", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

/* ------------------------------- Reminders ------------------------------ */

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RemindersTool(back: @Composable () -> Unit, model: ToolsViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var adding by rememberSaveable { mutableStateOf(false) }
    LifePage(
        title = "Reminders",
        navigationIcon = back,
        floatingActionButton = { ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Reminder") }) },
    ) {
        val s = state ?: run { items(3) { Skeleton(height = 64.dp) }; return@LifePage }
        // A repeating reminder marked done is only done for that time; it stays.
        val open = s.reminders.filter { it.doneAt == null || it.repeat != "none" }.sortedBy { it.remindAt }
        item { Muted("This app doesn't ring for reminders yet; that comes with notifications.", Modifier.padding(start = 4.dp)) }
        if (open.isEmpty()) item { EmptyState(Icons.Outlined.Alarm, "No reminders waiting") }
        items(open, key = { it.id }) { reminder ->
            LifeCard(Modifier.animateItem(), onClick = {
                haptics.confirm()
                model.saveReminder(reminder.copy(doneAt = nowIso()))
                undo("Done: “${reminder.title}”") { model.saveReminder(reminder) }
            }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Circle, "Tap to mark done", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(reminder.title, style = MaterialTheme.typography.bodyLarge)
                        Muted(
                            listOfNotNull(localDateOf(reminder.remindAt)?.let { friendlyDate(it) }, timeOf(reminder.remindAt), reminder.repeat.takeIf { it != "none" }?.replaceFirstChar { it.uppercase() })
                                .joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }

    if (adding) {
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        var title by rememberSaveable { mutableStateOf("") }
        val now = remember { LocalDateTime.now() }
        val choices = remember(now) {
            listOf(
                "In 1 hour" to now.plusHours(1),
                "Tonight " + clock.format(Date.from(now.toLocalDate().atTime(20, 0).atZone(ZoneId.systemDefault()).toInstant())) to now.toLocalDate().atTime(20, 0),
                "Tomorrow " + clock.format(Date.from(now.toLocalDate().plusDays(1).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant())) to now.toLocalDate().plusDays(1).atTime(9, 0),
            ).filter { it.second.isAfter(now) }
        }
        var at by remember { mutableStateOf(choices.first().second) }
        var pickingDate by remember { mutableStateOf(false) }
        var pickingTime by remember { mutableStateOf(false) }
        val custom = choices.none { it.second == at }
        ModalBottomSheet(onDismissRequest = { adding = false }, sheetState = sheet) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("New reminder", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(value = title, onValueChange = { title = it }, placeholder = { Text("Remind me to…") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for ((label, time) in choices) SelectChip(at == time, label, { at = time })
                    SelectChip(
                        custom,
                        if (custom) "${friendlyDate(at.toLocalDate())} ${clock.format(Date.from(at.atZone(ZoneId.systemDefault()).toInstant()))}" else "Pick a date and time…",
                        { pickingDate = true },
                    )
                }
                if (pickingDate) PickDate(at.toLocalDate(), dismiss = { pickingDate = false }) { date -> at = date.atTime(at.toLocalTime()); pickingTime = true }
                if (pickingTime) PickTime(at.toLocalTime(), dismiss = { pickingTime = false }) { time -> at = at.toLocalDate().atTime(time) }
                if (!at.isAfter(LocalDateTime.now())) Muted("That time has already passed.", style = MaterialTheme.typography.bodySmall)
                Button(
                    onClick = {
                        if (title.isBlank()) {
                            haptics.reject()
                        } else {
                            haptics.confirm()
                            model.saveReminder(Reminder(newId(), title.trim(), remindAt = at.atZone(ZoneId.systemDefault()).toOffsetDateTime().toString()))
                            adding = false
                        }
                    },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Save") }
            }
        }
    }
}

/* --------------------------- Projects & goals --------------------------- */

@Composable
fun ProjectsTool(back: @Composable () -> Unit, model: ToolsViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    LifePage(title = "Projects & goals", navigationIcon = back) {
        val s = state ?: run { items(3) { Skeleton() }; return@LifePage }
        val projects = s.projects.filter { it.status !in setOf("completed", "archived") }.sortedBy { it.name.lowercase() }
        val goals = s.goals.filter { it.status !in setOf("completed", "archived") }.sortedBy { it.name.lowercase() }
        item { SectionHeader("Projects") }
        if (projects.isEmpty()) item { Muted("No open projects", Modifier.padding(start = 4.dp)) }
        items(projects, key = { "p" + it.id }) { project ->
            val open = s.tasks.filter { it.projectId == project.id && it.parentTaskId == null }
            val done = open.count { !it.isOpen() }
            LifeCard(Modifier.animateItem()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBadge(Icons.Outlined.Flag, size = 34.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(project.name, style = MaterialTheme.typography.bodyLarge)
                        Muted(
                            listOfNotNull(
                                project.status.replace('_', ' ').replaceFirstChar { it.uppercase() },
                                if (open.isNotEmpty()) "$done of ${open.size} tasks done" else null,
                                project.dueDate?.let { "due ${friendlyDate(it)}" },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                // A real denominator: the project's own tasks.
                if (open.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    LinearProgressIndicator(progress = { done / open.size.toFloat() }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
        item { SectionHeader("Goals") }
        if (goals.isEmpty()) item { Muted("No open goals", Modifier.padding(start = 4.dp)) }
        items(goals, key = { "g" + it.id }) { goal ->
            LifeCard(Modifier.animateItem()) {
                Eyebrow(goal.targetDate?.let { "By ${friendlyDate(it)}" } ?: "Goal")
                Text(goal.name, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LinearProgressIndicator(progress = { (goal.progress / 100.0).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(10.dp))
                    Text("${goal.progress.toInt()}%", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
