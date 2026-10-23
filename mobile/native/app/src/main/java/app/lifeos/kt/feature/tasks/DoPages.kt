package app.lifeos.kt.feature.tasks

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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.EntityIcon
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IdentityPicker
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.identityColor
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Capability
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.data.logic.Count
import app.lifeos.kt.data.logic.GOAL_STATUSES
import app.lifeos.kt.data.logic.HABIT_CATEGORIES
import app.lifeos.kt.data.logic.PLANS
import app.lifeos.kt.data.logic.PROJECT_STATUSES
import app.lifeos.kt.data.logic.TASK_PRIORITIES
import app.lifeos.kt.data.logic.dayDots
import app.lifeos.kt.data.logic.goalProgress
import app.lifeos.kt.data.logic.guessHabitCategory
import app.lifeos.kt.data.logic.habitCategory
import app.lifeos.kt.data.logic.projectGoals
import app.lifeos.kt.data.logic.projectProgress
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.today.PriorityBadge
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** A thin bar for "done of total"; nothing is drawn without a real total. */
@Composable
private fun CountBar(count: Count, label: String) {
    if (count.total == 0) return
    Column(Modifier.fillMaxWidth()) {
        Muted("${count.done} of ${count.total} $label", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(progress = { count.done.toFloat() / count.total }, modifier = Modifier.fillMaxWidth().height(4.dp).clip(CircleShape))
    }
}

private fun date(iso: String?) = iso?.let { runCatching { LocalDate.parse(it.take(10)).format(DateTimeFormatter.ofPattern("d MMM yyyy")) }.getOrNull() }

/* ------------------------------- Projects ------------------------------- */

fun LazyListScope.projectsPage(s: DoState, model: DoViewModel) = item(key = "projects") { ProjectsPage(s, model) }

@Composable
private fun ProjectsPage(s: DoState, model: DoViewModel) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var plans by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { haptics.tick(); plans = true }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Start from a plan")
        }
        if (s.projects.isEmpty()) EmptyState(Icons.Outlined.Folder, "No projects yet", "A project holds the tasks that belong together, so related work stays in one place.")
        for ((status, label) in PROJECT_STATUSES) {
            val group = s.projects.filter { it.status == status }.sortedBy { it.name.lowercase() }
            if (group.isEmpty()) continue
            SectionHeader("$label · ${group.size}")
            for (project in group) {
                LifeCard(onClick = { editingId = project.id }) {
                    Row(verticalAlignment = Alignment.Top) {
                        EntityIcon(project.icon, project.color)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(project.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            project.description?.takeIf { it.isNotBlank() }?.let { Muted(it, maxLines = 2, style = MaterialTheme.typography.bodySmall) }
                            Spacer(Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                PriorityBadge(project.priority)
                                Muted(listOfNotNull(date(project.startDate)?.let { "Start $it" }, date(project.dueDate)?.let { "Due $it" }).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                            }
                            Spacer(Modifier.height(10.dp))
                            CountBar(projectProgress(s.tasks, project.id), "tasks")
                            val goals = projectGoals(s.tasks, s.goals, project.id)
                            if (goals.isNotEmpty()) Muted("Goals: " + goals.joinToString(", ") { it.name }, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
    s.projects.firstOrNull { it.id == editingId }?.let { project ->
        ProjectEditor(project, model, close = { editingId = null }, archive = {
            model.save(project.copy(status = "archived"))
            editingId = null
            undo("Archived “${project.name}”") { model.save(project) }
        }, delete = {
            model.delete(project)
            editingId = null
            undo("Deleted “${project.name}”") { model.save(project) }
        })
    }
    if (plans) PlansSheet(model, close = { plans = false })
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProjectEditor(project: Project?, model: DoViewModel, close: () -> Unit, archive: (() -> Unit)? = null, delete: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    val key = project?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(project?.name.orEmpty()) }
    var description by rememberSaveable(key) { mutableStateOf(project?.description.orEmpty()) }
    var status by rememberSaveable(key) { mutableStateOf(project?.status ?: "planning") }
    var priority by rememberSaveable(key) { mutableStateOf(project?.priority ?: "medium") }
    var start by rememberSaveable(key) { mutableStateOf(project?.startDate) }
    var due by rememberSaveable(key) { mutableStateOf(project?.dueDate) }
    var icon by rememberSaveable(key) { mutableStateOf(project?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(project?.color) }
    EditorSheet(if (project == null) "New project" else "Project", close, onSave = {
        if (name.isBlank()) { haptics.reject(); false } else {
            haptics.confirm()
            model.save((project ?: Project(newId(), name)).copy(name = name.trim(), description = description.trim().ifEmpty { null }, status = status, priority = priority, startDate = start, dueDate = due, icon = icon, color = color))
            true
        }
    }, archive = archive?.takeIf { project?.status != "archived" }, delete = delete) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp))
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
        Eyebrow("Status")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { for ((v, l) in PROJECT_STATUSES) SelectChip(status == v, l, { status = v }) }
        Eyebrow("Priority")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { for ((v, l) in TASK_PRIORITIES) SelectChip(priority == v, l, { priority = v }) }
        Eyebrow("Start date")
        DateChoice(start, { start = it })
        Eyebrow("Due date")
        DateChoice(due, { due = it })
    }
}

/** Ready-made plans: an ordinary project and its dated tasks from today. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlansSheet(model: DoViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Start from a plan", style = MaterialTheme.typography.titleLarge)
            Muted("Each one makes an ordinary project with its tasks spread over the days from today. Change, move or delete any of them afterwards.")
            for (plan in PLANS) {
                LifeCard(onClick = {
                    haptics.confirm()
                    model.startPlan(plan) { n -> toast("“${plan.name}” started: $n tasks.") }
                    close()
                }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        EntityIcon(plan.icon, null)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(plan.name, style = MaterialTheme.typography.titleSmall)
                            Muted(plan.summary, style = MaterialTheme.typography.bodySmall)
                            Muted("${plan.days} days · ${plan.steps.size} tasks", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}

/* -------------------------------- Goals -------------------------------- */

fun LazyListScope.goalsPage(s: DoState, model: DoViewModel) = item(key = "goals") { GoalsPage(s, model) }

@Composable
private fun GoalsPage(s: DoState, model: DoViewModel) {
    val undo = rememberUndo()
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.goals.isEmpty()) EmptyState(Icons.Outlined.TrackChanges, "No goals yet", "A goal names what you are working towards, so the tasks under it have a point.")
        for ((status, label) in GOAL_STATUSES) {
            val group = s.goals.filter { it.status == status }.sortedBy { it.targetDate ?: "9999" }
            if (group.isEmpty()) continue
            SectionHeader("$label · ${group.size}")
            for (goal in group) {
                LifeCard(onClick = { editingId = goal.id }) {
                    Row(verticalAlignment = Alignment.Top) {
                        EntityIcon(goal.icon, goal.color, fallback = Icons.Outlined.Flag)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(goal.name, style = MaterialTheme.typography.titleMedium)
                            Muted(listOfNotNull(goal.category, date(goal.targetDate)?.let { "Target $it" }).joinToString(" · ").ifEmpty { "No target date" }, style = MaterialTheme.typography.bodySmall)
                            Spacer(Modifier.height(10.dp))
                            CountBar(goalProgress(s.tasks, goal.id), "linked tasks done")
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Muted("Your own estimate", Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                                Text("${goal.progress.toInt()}%", style = MaterialTheme.typography.labelLarge)
                            }
                            LinearProgressIndicator(progress = { (goal.progress / 100).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape))
                        }
                    }
                }
            }
        }
    }
    s.goals.firstOrNull { it.id == editingId }?.let { goal ->
        GoalEditor(goal, model, close = { editingId = null }, delete = {
            model.delete(goal)
            editingId = null
            undo("Deleted “${goal.name}”") { model.save(goal) }
        })
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun GoalEditor(goal: Goal?, model: DoViewModel, close: () -> Unit, delete: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    val key = goal?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(goal?.name.orEmpty()) }
    var description by rememberSaveable(key) { mutableStateOf(goal?.description.orEmpty()) }
    var category by rememberSaveable(key) { mutableStateOf(goal?.category.orEmpty()) }
    var status by rememberSaveable(key) { mutableStateOf(goal?.status ?: "active") }
    var target by rememberSaveable(key) { mutableStateOf(goal?.targetDate) }
    var progress by rememberSaveable(key) { mutableFloatStateOf((goal?.progress ?: 0.0).toFloat()) }
    var icon by rememberSaveable(key) { mutableStateOf(goal?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(goal?.color) }
    EditorSheet(if (goal == null) "New goal" else "Goal", close, onSave = {
        if (name.isBlank()) { haptics.reject(); false } else {
            haptics.confirm()
            model.save((goal ?: Goal(newId(), name)).copy(name = name.trim(), description = description.trim().ifEmpty { null }, category = category.trim().ifEmpty { null }, status = status, targetDate = target, progress = progress.toDouble(), icon = icon, color = color))
            true
        }
    }, delete = delete) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().heightIn(min = 80.dp))
        OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
        Eyebrow("Status")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { for ((v, l) in GOAL_STATUSES) SelectChip(status == v, l, { status = v }) }
        Eyebrow("Target date")
        DateChoice(target, { target = it })
        Eyebrow("Progress (%) · your own estimate")
        Row(verticalAlignment = Alignment.CenterVertically) {
            // A tick at every tenth, so dragging it feels like a dial.
            Slider(value = progress, onValueChange = { v -> val r = (v / 5).toInt() * 5f; if ((r / 10).toInt() != (progress / 10).toInt()) haptics.tick(); progress = r }, valueRange = 0f..100f, modifier = Modifier.weight(1f))
            Text("${progress.toInt()}%", style = MaterialTheme.typography.titleMedium, modifier = Modifier.width(56.dp).padding(start = 8.dp))
        }
    }
}

/* -------------------------------- Habits -------------------------------- */

fun LazyListScope.habitsPage(s: DoState, model: DoViewModel) = item(key = "habits") { HabitsPage(s, model) }

@Composable
private fun HabitsPage(s: DoState, model: DoViewModel) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    val today = s.today.toString()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.habits.isEmpty()) EmptyState(Icons.Outlined.Repeat, "No habits yet", "A habit is a small thing you want to keep doing. Life OS records the days you did it, nothing more.")
        for ((category, label) in HABIT_CATEGORIES) {
            val group = s.habits.filter { habitCategory(it.name, it.category) == category }.sortedWith(compareByDescending<Habit> { it.active }.thenBy { it.name.lowercase() })
            if (group.isEmpty()) continue
            SectionHeader(label)
            for (habit in group) {
                val done = s.habitLogs.any { it.habitId == habit.id && it.logDate == today }
                val tint = identityColor(habit.color) ?: MaterialTheme.colorScheme.primary
                LifeCard(onClick = { editingId = habit.id }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(habit.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
                                if (!habit.active) Muted("  Archived", style = MaterialTheme.typography.labelSmall)
                            }
                            Muted(
                                listOfNotNull(
                                    if (habit.frequency == "weekly") "Weekly" else "Daily",
                                    "Target ${habit.target}×",
                                    if (habit.category == null) "area guessed from the name" else null,
                                ).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (habit.active) {
                            // Today's mark, right on the card.
                            Box(
                                Modifier.size(40.dp).clip(CircleShape)
                                    .background(if (done) tint else Color.Transparent)
                                    .border(1.5.dp, if (done) tint else MaterialTheme.colorScheme.outline, CircleShape)
                                    .clickable { if (!done) haptics.confirm() else haptics.tick(); model.toggleHabit(habit) },
                                contentAlignment = Alignment.Center,
                            ) { if (done) Icon(Icons.Filled.Check, "Done today; tap to undo", tint = Color.White, modifier = Modifier.size(20.dp)) }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    // The last two weeks as dots: filled where logged. The count beside them is plain.
                    val dots = dayDots(s.habitLogs, habit.id, s.today)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            for ((day, logged) in dots) {
                                Box(
                                    Modifier.size(10.dp).clip(CircleShape)
                                        .background(if (logged) tint else Color.Transparent)
                                        .border(1.dp, if (logged) tint else if (day == s.today) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.outline, CircleShape),
                                )
                            }
                        }
                        Muted("${dots.count { it.second }} of 14 days", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
    s.habits.firstOrNull { it.id == editingId }?.let { habit ->
        HabitEditor(habit, model, close = { editingId = null }, delete = {
            model.delete(habit)
            editingId = null
            undo("Deleted “${habit.name}”") { model.save(habit) }
        })
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HabitEditor(habit: Habit?, model: DoViewModel, close: () -> Unit, delete: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    val key = habit?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(habit?.name.orEmpty()) }
    var description by rememberSaveable(key) { mutableStateOf(habit?.description.orEmpty()) }
    var frequency by rememberSaveable(key) { mutableStateOf(habit?.frequency ?: "daily") }
    var target by rememberSaveable(key) { mutableStateOf((habit?.target ?: 1).toString()) }
    var category by rememberSaveable(key) { mutableStateOf(habit?.category) }
    var active by rememberSaveable(key) { mutableStateOf(habit?.active ?: true) }
    var icon by rememberSaveable(key) { mutableStateOf(habit?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(habit?.color) }
    val guessed = guessHabitCategory(name)
    EditorSheet(if (habit == null) "New habit" else "Habit", close, onSave = {
        if (name.isBlank()) { haptics.reject(); false } else {
            haptics.confirm()
            model.save((habit ?: Habit(newId(), name)).copy(name = name.trim(), description = description.trim().ifEmpty { null }, frequency = frequency, target = target.toIntOrNull()?.coerceAtLeast(1) ?: 1, category = category, active = active, icon = icon, color = color))
            true
        }
    }, delete = delete, deleteNote = "Its logging history will be removed too.") {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        Eyebrow("Part of life")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for ((v, l) in HABIT_CATEGORIES) SelectChip((category ?: guessed) == v, if (category == null && guessed == v) "$l (guess)" else l, { category = v })
        }
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Eyebrow("Frequency")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectChip(frequency == "daily", "Daily", { frequency = "daily" })
            SelectChip(frequency == "weekly", "Weekly", { frequency = "weekly" })
        }
        OutlinedTextField(value = target, onValueChange = { target = it.filter(Char::isDigit).take(3) }, label = { Text("Target per period") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = MaterialTheme.shapes.medium, modifier = Modifier.width(180.dp))
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Active", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Switch(checked = active, onCheckedChange = { haptics.tick(); active = it })
        }
    }
}

/* ----------------------------- Capabilities ----------------------------- */

fun LazyListScope.capabilitiesPage(s: DoState, model: DoViewModel) = item(key = "capabilities") { CapabilitiesPage(s, model) }

@Composable
private fun CapabilitiesPage(s: DoState, model: DoViewModel) {
    val undo = rememberUndo()
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var viewingId by rememberSaveable { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.capabilities.isEmpty()) EmptyState(Icons.Outlined.AutoAwesome, "No capabilities yet", "A capability is something you are getting better at. Finished work becomes its evidence over time.")
        for (capability in s.capabilities.sortedBy { it.name.lowercase() }) {
            val count = s.evidence.count { it.capabilityId == capability.id }
            LifeCard(onClick = { viewingId = capability.id }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    EntityIcon(capability.icon, capability.color, fallback = Icons.Outlined.AutoAwesome)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(capability.name, style = MaterialTheme.typography.titleMedium)
                        capability.description?.takeIf { it.isNotBlank() }?.let { Muted(it, maxLines = 2, style = MaterialTheme.typography.bodySmall) }
                        Muted("$count evidence ${if (count == 1) "event" else "events"}", style = MaterialTheme.typography.labelSmall)
                    }
                    androidx.compose.material3.IconButton(onClick = { editingId = capability.id }) { Icon(Icons.Outlined.Edit, "Edit") }
                }
            }
        }
    }
    s.capabilities.firstOrNull { it.id == editingId }?.let { capability ->
        CapabilityEditor(capability, model, close = { editingId = null }, delete = {
            model.delete(capability)
            editingId = null
            undo("Deleted “${capability.name}”") { model.save(capability) }
        })
    }
    s.capabilities.firstOrNull { it.id == viewingId }?.let { capability -> EvidenceSheet(capability, s, close = { viewingId = null }) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EvidenceSheet(capability: Capability, s: DoState, close: () -> Unit) {
    val items = s.evidence.filter { it.capabilityId == capability.id }.sortedByDescending { it.createdAt ?: "" }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(capability.name, style = MaterialTheme.typography.titleLarge)
            Muted("Finished work linked to it, newest first.")
            if (items.isEmpty()) Muted("Nothing yet. When you finish a task that has this capability, it shows up here.")
            for (item in items) {
                val task = s.tasks.firstOrNull { it.id == item.taskId }
                Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(task?.title ?: "A finished task", style = MaterialTheme.typography.bodyLarge)
                    Muted(listOfNotNull(friendlyDate(item.createdAt?.take(10)), item.note).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                }
                HorizontalDivider()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CapabilityEditor(capability: Capability?, model: DoViewModel, close: () -> Unit, delete: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    val key = capability?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(capability?.name.orEmpty()) }
    var description by rememberSaveable(key) { mutableStateOf(capability?.description.orEmpty()) }
    var icon by rememberSaveable(key) { mutableStateOf(capability?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(capability?.color) }
    EditorSheet(if (capability == null) "Add capability" else "Capability", close, onSave = {
        if (name.isBlank()) { haptics.reject(); false } else {
            haptics.confirm()
            model.save((capability ?: Capability(newId(), name)).copy(name = name.trim(), description = description.trim().ifEmpty { null }, icon = icon, color = color))
            true
        }
    }, delete = delete) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description (optional)") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
    }
}

/* ------------------------------ shared sheet ------------------------------ */

/** A form sheet: fields, then Delete/Archive on the left and Save on the right. [onSave] returns false to keep it open. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditorSheet(
    title: String,
    close: () -> Unit,
    onSave: () -> Boolean,
    archive: (() -> Unit)? = null,
    delete: (() -> Unit)? = null,
    deleteNote: String? = null,
    fields: @Composable () -> Unit,
) {
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            fields()
            if (confirmDelete && deleteNote != null) Muted(deleteNote, style = MaterialTheme.typography.bodySmall)
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (delete != null) {
                    TextButton(onClick = { if (deleteNote != null && !confirmDelete) confirmDelete = true else delete() }) {
                        Icon(Icons.Outlined.Delete, null, tint = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.width(6.dp))
                        Text(if (confirmDelete) "Delete for good" else "Delete", color = MaterialTheme.colorScheme.error)
                    }
                }
                if (archive != null) TextButton(onClick = archive) { Icon(Icons.Outlined.Archive, null); Spacer(Modifier.width(6.dp)); Text("Archive") }
                Spacer(Modifier.weight(1f))
                Button(onClick = { if (onSave()) close() }, shape = MaterialTheme.shapes.medium, modifier = Modifier.height(48.dp)) { Text("Save") }
            }
        }
    }
}
