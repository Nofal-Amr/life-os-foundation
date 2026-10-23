package app.lifeos.kt.feature.tasks

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.Capability
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.logic.TASK_ENERGY
import app.lifeos.kt.data.logic.TASK_PRIORITIES
import app.lifeos.kt.data.logic.TASK_REPEATS
import app.lifeos.kt.data.logic.TASK_STATUSES
import app.lifeos.kt.data.logic.dateOrderProblem
import app.lifeos.kt.data.logic.isOpen
import java.time.LocalTime

/** What the editor hands back to be saved. */
data class TaskDraft(
    val title: String, val description: String?, val status: String, val priority: String,
    val startDate: String?, val dueDate: String?, val dueTime: String?, val maxDate: String?,
    val energy: Int?, val repeat: String?, val estimateValue: Double?, val estimateUnit: String,
    val projectId: String?, val capabilityId: String?, val goalId: String?,
)

private val UNITS = listOf("minutes" to "min", "hours" to "h", "days" to "d")
private val UNIT_MINUTES = mapOf("minutes" to 1, "hours" to 60, "days" to 1440)

fun TaskDraft.applyTo(task: Task): Task = task.copy(
    title = title.trim(), description = description?.trim()?.ifEmpty { null }, status = status, priority = priority,
    startDate = startDate, dueDate = dueDate, dueTime = dueTime, maxDate = maxDate, energy = energy, repeat = repeat,
    estimatedMinutes = estimateValue?.let { (it * (UNIT_MINUTES[estimateUnit] ?: 1)).toInt() }?.takeIf { it > 0 },
    estimateUnit = if (estimateValue != null) estimateUnit else task.estimateUnit,
    projectId = projectId, capabilityId = capabilityId, goalId = goalId,
)

/**
 * Every field of the web's task form, on one scrolling sheet: the common ones
 * first, the rest under "More". Steps come after saving, as on the web.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TaskEditor(
    task: Task?,
    steps: List<Task>,
    projects: List<Project>,
    goals: List<Goal>,
    capabilities: List<Capability>,
    presetDue: String?,
    save: (TaskDraft) -> Unit,
    close: () -> Unit,
    delete: (() -> Unit)? = null,
    toggleStep: (Task) -> Unit = {},
    addStep: (String) -> Unit = {},
    removeStep: (Task) -> Unit = {},
    moveStep: (Task, Int) -> Unit = { _, _ -> },
    newProject: (String, (String) -> Unit) -> Unit = { _, _ -> },
    newGoal: (String, (String) -> Unit) -> Unit = { _, _ -> },
    newCapability: (String, (String) -> Unit) -> Unit = { _, _ -> },
) {
    val haptics = rememberHaptics()
    val key = task?.id ?: "new"
    var title by rememberSaveable(key) { mutableStateOf(task?.title.orEmpty()) }
    var description by rememberSaveable(key) { mutableStateOf(task?.description.orEmpty()) }
    var status by rememberSaveable(key) { mutableStateOf(task?.status ?: "inbox") }
    var priority by rememberSaveable(key) { mutableStateOf(task?.priority ?: "medium") }
    var start by rememberSaveable(key) { mutableStateOf(task?.startDate) }
    var due by rememberSaveable(key) { mutableStateOf(task?.dueDate ?: presetDue) }
    var time by rememberSaveable(key) { mutableStateOf(task?.dueTime?.take(5)) }
    var max by rememberSaveable(key) { mutableStateOf(task?.maxDate) }
    var energy by rememberSaveable(key) { mutableStateOf(task?.energy) }
    var repeat by rememberSaveable(key) { mutableStateOf(task?.repeat) }
    val unit0 = task?.estimateUnit ?: "minutes"
    var unit by rememberSaveable(key) { mutableStateOf(unit0) }
    var estimate by rememberSaveable(key) { mutableStateOf(task?.estimatedMinutes?.let { m -> (m.toDouble() / (UNIT_MINUTES[unit0] ?: 1)).let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() } }.orEmpty()) }
    var projectId by rememberSaveable(key) { mutableStateOf(task?.projectId) }
    var goalId by rememberSaveable(key) { mutableStateOf(task?.goalId) }
    var capabilityId by rememberSaveable(key) { mutableStateOf(task?.capabilityId) }
    var more by rememberSaveable(key) { mutableStateOf(task != null && (task.startDate != null || task.maxDate != null || task.goalId != null || task.capabilityId != null || task.estimatedMinutes != null)) }
    var pickingTime by rememberSaveable(key) { mutableStateOf(false) }
    var newStep by rememberSaveable(key) { mutableStateOf("") }
    var naming by rememberSaveable(key) { mutableStateOf<String?>(null) }
    var newName by rememberSaveable(key) { mutableStateOf("") }
    val problem = dateOrderProblem(start, due, max)

    fun submit() {
        when {
            title.isBlank() -> haptics.reject()
            problem != null -> haptics.reject()
            else -> {
                haptics.confirm()
                save(TaskDraft(title, description, status, priority, start, due, time?.let { "$it:00" }, max, energy, repeat, estimate.replace(',', '.').toDoubleOrNull(), unit, projectId, capabilityId, goalId))
            }
        }
    }

    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (task == null) "New task" else "Task", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true, textStyle = MaterialTheme.typography.titleMedium, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp))

            Eyebrow("Due")
            DateChoice(due, { due = it })
            Row(verticalAlignment = Alignment.CenterVertically) {
                SelectChip(time != null, time?.let { "At $it" } ?: "Add a time", { pickingTime = true }, leadingIcon = Icons.Outlined.Schedule)
                if (time != null) IconButton(onClick = { haptics.tick(); time = null }) { Icon(Icons.Outlined.Close, "Remove the time") }
            }
            if (pickingTime) PickTime(time?.let { LocalTime.parse(it) } ?: LocalTime.of(9, 0), dismiss = { pickingTime = false }) { time = "%02d:%02d".format(it.hour, it.minute) }

            Eyebrow("Status")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((value, label) in TASK_STATUSES) SelectChip(status == value, label, { status = value })
            }
            Eyebrow("Priority")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for ((value, label) in TASK_PRIORITIES) SelectChip(priority == value, label, { priority = value })
            }
            Eyebrow("Energy it needs")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((value, label, _) in TASK_ENERGY) SelectChip(energy == value, label, { energy = if (energy == value) null else value })
            }
            Muted("Optional. On a low day, Today puts low-energy tasks first.", style = MaterialTheme.typography.bodySmall)
            Eyebrow("Repeat")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SelectChip(repeat == null, "Doesn't repeat", { repeat = null })
                for ((value, label) in TASK_REPEATS) SelectChip(repeat == value, label, { repeat = value })
            }
            if (repeat != null) Muted("When you tick it off, the next one appears on its next date.", style = MaterialTheme.typography.bodySmall)

            Eyebrow("Project")
            Picker(projects.filter { it.status !in setOf("archived", "completed") }.map { it.id to it.name }, projectId, { projectId = it }, none = "No project", onNew = { naming = "project" })

            TextButton(onClick = { haptics.tick(); more = !more }) { Text(if (more) "Fewer details" else "More details: start, max date, estimate, goal, capability") }
            AnimatedVisibility(more) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Eyebrow("Start date (optional)")
                    DateChoice(start, { start = it })
                    Eyebrow("Max date (optional)")
                    DateChoice(max, { max = it })
                    Eyebrow("Estimate (optional)")
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = estimate, onValueChange = { estimate = it }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), shape = MaterialTheme.shapes.medium, modifier = Modifier.width(110.dp))
                        for ((value, label) in UNITS) SelectChip(unit == value, label, { unit = value })
                    }
                    Eyebrow("Goal (optional)")
                    Picker(goals.filter { it.status != "archived" }.map { it.id to it.name }, goalId, { goalId = it }, none = "No goal", onNew = { naming = "goal" })
                    Eyebrow("Capability (optional)")
                    Picker(capabilities.map { it.id to it.name }, capabilityId, { capabilityId = it }, none = "No capability", onNew = { naming = "capability" })
                }
            }
            naming?.let { kind ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(value = newName, onValueChange = { newName = it }, label = { Text("New $kind name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
                    TextButton(onClick = {
                        if (newName.isBlank()) haptics.reject() else {
                            haptics.confirm()
                            when (kind) {
                                "project" -> newProject(newName.trim()) { projectId = it }
                                "goal" -> newGoal(newName.trim()) { goalId = it; more = true }
                                else -> newCapability(newName.trim()) { capabilityId = it; more = true }
                            }
                            newName = ""
                            naming = null
                        }
                    }) { Text("Create") }
                }
            }

            problem?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }

            if (task != null && task.parentTaskId == null) {
                HorizontalDivider()
                Eyebrow(if (steps.isEmpty()) "Steps" else "Steps · ${steps.count { !it.isOpen() }} of ${steps.size} done")
                Muted("Break it into small first moves; the first one can be tiny.", style = MaterialTheme.typography.bodySmall)
                Column {
                    steps.forEachIndexed { index, step ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (step.isOpen()) haptics.confirm() else haptics.tick(); toggleStep(step) }) {
                                Icon(if (step.isOpen()) Icons.Outlined.Circle else Icons.Filled.CheckCircle, if (step.isOpen()) "Finish step" else "Mark step not done", tint = if (step.isOpen()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
                            }
                            Text(step.title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f), textDecoration = if (step.isOpen()) null else TextDecoration.LineThrough)
                            if (index > 0) IconButton(onClick = { haptics.tick(); moveStep(step, -1) }) { Icon(Icons.Outlined.ArrowUpward, "Move up", Modifier.size(18.dp)) }
                            if (index < steps.lastIndex) IconButton(onClick = { haptics.tick(); moveStep(step, 1) }) { Icon(Icons.Outlined.ArrowDownward, "Move down", Modifier.size(18.dp)) }
                            IconButton(onClick = { haptics.tick(); removeStep(step) }) { Icon(Icons.Outlined.Close, "Remove step", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    OutlinedTextField(
                        value = newStep,
                        onValueChange = { newStep = it },
                        placeholder = { Text("Add a step") },
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { if (newStep.isNotBlank()) { haptics.confirm(); addStep(newStep.trim()); newStep = "" } }),
                        trailingIcon = { IconButton(onClick = { if (newStep.isNotBlank()) { haptics.confirm(); addStep(newStep.trim()); newStep = "" } else haptics.reject() }) { Icon(Icons.Filled.Add, "Add step") } },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else if (task == null) {
                Muted("Save the task first, then add steps to it.", style = MaterialTheme.typography.bodySmall)
            }
            if (task != null && task.postponedCount > 0) {
                Muted("Moved ${task.postponedCount} ${if (task.postponedCount == 1) "time" else "times"}${task.originalDueDate?.let { ", first planned for $it" } ?: ""}.", style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (delete != null) {
                    TextButton(onClick = delete) {
                        Icon(Icons.Outlined.Delete, null, tint = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.width(6.dp))
                        Text("Delete", color = MaterialTheme.colorScheme.error)
                    }
                }
                Spacer(Modifier.weight(1f))
                Button(onClick = ::submit, shape = MaterialTheme.shapes.medium, modifier = Modifier.height(48.dp)) { Text(if (task == null) "Add task" else "Save") }
            }
        }
    }
}

/** Choose one of a short list (or none), with a way to make a new one inline. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Picker(options: List<Pair<String, String>>, value: String?, set: (String?) -> Unit, none: String, onNew: () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SelectChip(value == null, none, { set(null) })
        for ((id, name) in options) SelectChip(value == id, name, { set(id) })
        SelectChip(false, "New…", onNew, leadingIcon = Icons.Filled.Add)
    }
}
