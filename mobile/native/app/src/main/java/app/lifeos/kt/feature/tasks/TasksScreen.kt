package app.lifeos.kt.feature.tasks

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.outlined.EventRepeat
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SwipeAction
import app.lifeos.kt.core.designsystem.SwipeActions
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.TaskGroup
import app.lifeos.kt.data.logic.dueDetail
import app.lifeos.kt.data.logic.groupTasks
import app.lifeos.kt.data.logic.isOpen
import app.lifeos.kt.data.logic.stepsOf
import app.lifeos.kt.data.newId
import app.lifeos.kt.data.postponed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class TaskRow(val task: Task, val detail: String?, val steps: List<Task>)
data class TasksState(val today: LocalDate, val groups: List<Pair<TaskGroup, List<TaskRow>>>, val all: List<Task>)

@HiltViewModel
class TasksViewModel @Inject constructor(private val repo: TaskRepository) : ViewModel() {
    val state: StateFlow<TasksState?> = repo.tasks.map { all ->
        val today = LocalDate.now()
        TasksState(
            today,
            groupTasks(all, today).map { (group, tasks) -> group to tasks.map { TaskRow(it, dueDetail(it, today), stepsOf(it, all)) } },
            all,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setDone(task: Task, done: Boolean) = viewModelScope.launch { repo.setDone(task, done) }
    fun moveTo(task: Task, date: String?) = viewModelScope.launch { repo.moveTo(task, date) }
    fun restore(task: Task) = viewModelScope.launch { repo.restore(task) }
    fun delete(task: Task) = viewModelScope.launch { repo.delete(task) }
    fun add(title: String, due: String?) = viewModelScope.launch { repo.add(title, due) }

    /** Saves edits from the task sheet; a later date is recorded as a postponement, as on the web. */
    fun save(before: Task, after: Task) = viewModelScope.launch {
        repo.save(if (after.dueDate != before.dueDate) postponed(after.copy(dueDate = before.dueDate), after.dueDate) else after)
    }

    fun addStep(parent: Task, title: String) = viewModelScope.launch {
        val position = (state.value?.all?.filter { it.parentTaskId == parent.id }?.maxOfOrNull { it.position } ?: -1) + 1
        repo.save(Task(id = newId(), title = title.trim(), parentTaskId = parent.id, status = "todo", position = position, projectId = parent.projectId))
    }
}

@Composable
fun TasksScreen(model: TasksViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val undo = rememberUndo()
    var adding by rememberSaveable { mutableStateOf(false) }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    var actionsId by rememberSaveable { mutableStateOf<String?>(null) }

    fun toggle(task: Task) {
        val open = task.isOpen()
        model.setDone(task, open)
        undo(if (open) "Finished “${task.title}”" else "“${task.title}” is open again") { model.restore(task) }
    }
    fun move(task: Task, date: String?, message: String) {
        model.moveTo(task, date)
        undo(message) { model.restore(task) }
    }
    fun delete(task: Task) {
        model.delete(task)
        undo("Deleted “${task.title}”") { model.restore(task) }
    }

    LifePage(
        title = "Do",
        actions = { SyncAction() },
        refreshing = sync.state.running,
        onRefresh = sync.syncNow,
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Task") })
        },
    ) {
        val s = state
        if (s == null) {
            items(4) { Skeleton(height = 64.dp) }
            return@LifePage
        }
        if (s.groups.isEmpty()) {
            item { EmptyState(Icons.Outlined.TaskAlt, "Nothing here yet", "Add a task with the button below. It's saved on this phone straight away.") }
        }
        for ((group, rows) in s.groups) {
            item(key = "h-${group.name}") { SectionHeader("${group.label} · ${rows.size}", Modifier.animateItem()) }
            items(rows, key = { it.task.id }) { row ->
                val task = row.task
                val open = task.isOpen()
                SwipeActions(
                    start = SwipeAction(if (open) "Done" else "Not done", if (open) Icons.Outlined.TaskAlt else Icons.AutoMirrored.Outlined.Undo, MaterialTheme.colorScheme.primary) { toggle(task) },
                    end = if (open) SwipeAction("Tomorrow", Icons.Outlined.EventRepeat, MaterialTheme.colorScheme.tertiary) {
                        move(task, s.today.plusDays(1).toString(), "Moved to tomorrow")
                    } else null,
                    modifier = Modifier.animateItem(),
                ) {
                    TaskCard(row, onToggle = { toggle(task) }, onOpen = { openId = task.id }, onLongPress = { actionsId = task.id })
                }
            }
        }
        item { Muted("Swipe right to finish, left for tomorrow. Tap a task to open it.", Modifier.padding(start = 4.dp, top = 8.dp), style = MaterialTheme.typography.bodySmall) }
    }

    val s = state
    if (adding) AddTaskSheet(today = s?.today ?: LocalDate.now(), close = { adding = false }, add = model::add)
    s?.all?.firstOrNull { it.id == openId }?.let { task ->
        TaskSheet(task, stepsOf(task, s.all), close = { openId = null }, model = model, delete = { delete(task); openId = null }, toggle = ::toggle)
    }
    s?.all?.firstOrNull { it.id == actionsId }?.let { task ->
        QuickActions(
            task,
            today = s.today,
            close = { actionsId = null },
            open = { actionsId = null; openId = task.id },
            move = { date, message -> move(task, date, message); actionsId = null },
            delete = { delete(task); actionsId = null },
        )
    }
}

@Composable
private fun TaskCard(row: TaskRow, onToggle: () -> Unit, onOpen: () -> Unit, onLongPress: () -> Unit) {
    val haptics = rememberHaptics()
    val task = row.task
    val done = !task.isOpen()
    val tint by animateColorAsState(if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, label = "check")
    LifeCard(onClick = onOpen, onLongClick = onLongPress, contentPadding = PaddingValues(start = 4.dp, end = 14.dp, top = 6.dp, bottom = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { if (!done) haptics.confirm() else haptics.tick(); onToggle() }) {
                Icon(if (done) Icons.Filled.CheckCircle else Icons.Outlined.Circle, contentDescription = if (done) "Mark “${task.title}” not done" else "Finish “${task.title}”", tint = tint, modifier = Modifier.size(26.dp))
            }
            Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                Text(
                    task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (done) TextDecoration.LineThrough else null,
                    color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                )
                val parts = listOfNotNull(
                    row.detail,
                    if (row.steps.isNotEmpty()) "${row.steps.count { !it.isOpen() }} of ${row.steps.size} steps" else null,
                    priorityLabel(task.priority),
                )
                if (parts.isNotEmpty()) Muted(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** Only the priorities worth reading out; medium is the default and says nothing. */
private fun priorityLabel(priority: String) = when (priority) {
    "high" -> "High"
    "critical" -> "Critical"
    "low" -> "Low"
    else -> null
}

private val PRIORITIES = listOf("low" to "Low", "medium" to "Medium", "high" to "High")

/** The whole task: title, notes, date, priority, steps. Changes save when you tap Save. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskSheet(task: Task, steps: List<Task>, close: () -> Unit, model: TasksViewModel, delete: () -> Unit, toggle: (Task) -> Unit) {
    val haptics = rememberHaptics()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var title by rememberSaveable(task.id) { mutableStateOf(task.title) }
    var notes by rememberSaveable(task.id) { mutableStateOf(task.description.orEmpty()) }
    var due by rememberSaveable(task.id) { mutableStateOf(task.dueDate) }
    var priority by rememberSaveable(task.id) { mutableStateOf(if (task.priority == "critical") "high" else task.priority) }
    var newStep by rememberSaveable(task.id) { mutableStateOf("") }

    fun save() {
        if (title.isBlank()) {
            haptics.reject()
            return
        }
        haptics.confirm()
        model.save(task, task.copy(title = title.trim(), description = notes.trim().ifEmpty { null }, dueDate = due, priority = if (task.priority == "critical" && priority == "high") "critical" else priority))
        close()
    }

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { toggle(task); close() }) {
                    Icon(if (task.isOpen()) Icons.Outlined.Circle else Icons.Filled.CheckCircle, if (task.isOpen()) "Finish" else "Mark not done", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    textStyle = MaterialTheme.typography.titleLarge,
                    shape = MaterialTheme.shapes.medium,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.weight(1f),
                )
            }
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                placeholder = { Text("Notes") },
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth().heightIn(min = 88.dp),
            )
            Eyebrow("When")
            DateChoice(due, { due = it })
            Eyebrow("Priority")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                PRIORITIES.forEachIndexed { index, (value, label) ->
                    SegmentedButton(selected = priority == value, onClick = { haptics.tick(); priority = value }, shape = SegmentedButtonDefaults.itemShape(index, PRIORITIES.size)) { Text(label) }
                }
            }
            Eyebrow(if (steps.isEmpty()) "Steps" else "Steps · ${steps.count { !it.isOpen() }} of ${steps.size} done")
            Muted("Break it into small first moves; the first one can be tiny.", style = MaterialTheme.typography.bodySmall)
            Column {
                for (step in steps) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { if (step.isOpen()) haptics.confirm() else haptics.tick(); model.setDone(step, step.isOpen()) }) {
                            Icon(if (step.isOpen()) Icons.Outlined.Circle else Icons.Filled.CheckCircle, if (step.isOpen()) "Finish step" else "Mark step not done", tint = if (step.isOpen()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
                        }
                        Text(step.title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f), textDecoration = if (step.isOpen()) null else TextDecoration.LineThrough)
                        IconButton(onClick = { haptics.tick(); model.delete(step) }) { Icon(Icons.Outlined.Close, "Remove step", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
                OutlinedTextField(
                    value = newStep,
                    onValueChange = { newStep = it },
                    placeholder = { Text("Add a step") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        if (newStep.isNotBlank()) {
                            haptics.confirm()
                            model.addStep(task, newStep)
                            newStep = ""
                        }
                    }),
                    trailingIcon = {
                        IconButton(onClick = { if (newStep.isNotBlank()) { haptics.confirm(); model.addStep(task, newStep); newStep = "" } else haptics.reject() }) {
                            Icon(Icons.Filled.Add, "Add step")
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (task.postponedCount > 0) {
                Muted("Moved ${task.postponedCount} ${if (task.postponedCount == 1) "time" else "times"}${task.originalDueDate?.let { ", first planned for $it" } ?: ""}.", style = MaterialTheme.typography.bodySmall)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = delete) {
                    Icon(Icons.Outlined.Delete, null, tint = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.width(6.dp))
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.weight(1f))
                Button(onClick = ::save, shape = MaterialTheme.shapes.medium) { Text("Save") }
            }
        }
    }
}

/** Long-press: the few things you'd do without opening the task. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickActions(task: Task, today: LocalDate, close: () -> Unit, open: () -> Unit, move: (String?, String) -> Unit, delete: () -> Unit) {
    val sheet = rememberModalBottomSheetState()
    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 12.dp)) {
            Text(task.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            HorizontalDivider()
            ActionRow("Open", Icons.Outlined.TaskAlt, onClick = open)
            ActionRow("Tomorrow", Icons.Outlined.EventRepeat) { move(today.plusDays(1).toString(), "Moved to tomorrow") }
            ActionRow("Next week", Icons.Outlined.DateRange) { move(today.plusWeeks(1).toString(), "Moved to next week") }
            if (task.dueDate != null) ActionRow("Remove the date", Icons.Outlined.EventBusy) { move(null, "Date removed") }
            ActionRow("Delete", Icons.Outlined.Delete, danger = true, onClick = delete)
        }
    }
}

@Composable
private fun ActionRow(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, danger: Boolean = false, onClick: () -> Unit) {
    val haptics = rememberHaptics()
    val color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    TextButton(
        onClick = { haptics.tick(); onClick() },
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp),
    ) {
        Icon(icon, null, tint = color)
        Spacer(Modifier.width(16.dp))
        Text(label, color = color, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddTaskSheet(today: LocalDate, close: () -> Unit, add: (String, String?) -> Unit) {
    val haptics = rememberHaptics()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val focus = remember { FocusRequester() }
    var title by rememberSaveable { mutableStateOf("") }
    var due by rememberSaveable { mutableStateOf<String?>(today.toString()) }
    var added by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) { focus.requestFocus() }

    fun submit() {
        if (title.isBlank()) {
            haptics.reject()
            return
        }
        haptics.confirm()
        add(title, due)
        title = ""
        added++
    }

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("New task", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                placeholder = { Text("What needs doing?") },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
            DateChoice(due, { due = it })
            AnimatedVisibility(added > 0) { Muted(if (added == 1) "Added. Type the next one, or close." else "$added added.") }
            Button(onClick = ::submit, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) { Text("Add") }
        }
    }
}
