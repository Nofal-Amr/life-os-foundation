package app.lifeos.kt.feature.tasks

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.outlined.EventRepeat
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Stop
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
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.designsystem.BarChart
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LocalStatusBarHandled
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.MIN_POINTS
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.NotEnoughData
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SwipeAction
import app.lifeos.kt.core.designsystem.SwipeActions
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.logic.TASK_STATUSES
import app.lifeos.kt.data.logic.TaskFilter
import app.lifeos.kt.data.logic.dueDetail
import app.lifeos.kt.data.logic.filterTasks
import app.lifeos.kt.data.logic.isOpen
import app.lifeos.kt.data.logic.splitTaskLines
import app.lifeos.kt.data.logic.stepsOf
import app.lifeos.kt.data.logic.tasksCompletedPerWeek
import app.lifeos.kt.feature.today.PriorityBadge
import app.lifeos.kt.feature.today.ShrinkItSheet
import app.lifeos.kt.feature.today.StuckHelperSheet
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

private val PAGES = listOf(
    "Tasks" to "One list, filtered by when it matters.",
    "Projects" to "Everything you're moving forward, grouped by status.",
    "Goals" to "Longer horizons, updated by hand when things move.",
    "Habits" to "Small repeated actions, logged daily or weekly.",
    "Capabilities" to "What you are building, backed by evidence.",
)

/**
 * Do: the web's five pages (Tasks, Projects, Goals, Habits, Capabilities) as
 * tabs you can also swipe between; a soft tick marks each page change.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoScreen(openTaskId: String? = null, page: Int = 0, model: DoViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val pager = rememberPagerState(initialPage = page) { PAGES.size }
    val scope = rememberCoroutineScope()
    var adding by rememberSaveable { mutableIntStateOf(-1) }
    LaunchedEffect(pager) {
        var first = true
        snapshotFlow { pager.settledPage }.collect { if (first) first = false else haptics.tick() }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            val top = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
            Row(top.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Do", style = MaterialTheme.typography.headlineLarge)
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
            HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1) { page ->
                val s = state
                PageList {
                    if (s == null) {
                        items(4) { Skeleton(height = 70.dp) }
                        return@PageList
                    }
                    when (page) {
                        0 -> item(key = "tasks") { TasksPage(s, model, openTaskId) }
                        1 -> projectsPage(s, model)
                        2 -> goalsPage(s, model)
                        3 -> habitsPage(s, model)
                        else -> capabilitiesPage(s, model)
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { haptics.tick(); adding = pager.currentPage },
            icon = { Icon(Icons.Filled.Add, null) },
            text = { Text(listOf("Task", "Project", "Goal", "Habit", "Capability")[pager.currentPage]) },
            modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
        )
    }

    val s = state ?: return
    when (adding) {
        0 -> AddTaskSheet(s.today, close = { adding = -1 }, addMany = model::addMany)
        1 -> ProjectEditor(null, model, close = { adding = -1 })
        2 -> GoalEditor(null, model, close = { adding = -1 })
        3 -> HabitEditor(null, model, close = { adding = -1 })
        4 -> CapabilityEditor(null, model, close = { adding = -1 })
    }
}

/** A page's scrolling list, with pull to refresh. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PageList(content: LazyListScope.() -> Unit) {
    val sync = LocalSyncStatus.current
    PullToRefreshBox(isRefreshing = sync.state.running, onRefresh = sync.syncNow, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 112.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

/* -------------------------------- Tasks -------------------------------- */

/**
 * The web's Tasks page: the weekly figure, the six filters and every task with
 * its badges and steps. Native touches: the circle finishes, swipe right to
 * finish or left for tomorrow, long-press for the rest, Undo for all of it.
 */
@Composable
private fun TasksPage(s: DoState, model: DoViewModel, openTaskId: String?) {
    val undo = rememberUndo()
    val toast = rememberToast()
    var filter by rememberSaveable { mutableStateOf(TaskFilter.Today) }
    var openId by rememberSaveable { mutableStateOf(openTaskId) }
    var actionsId by rememberSaveable { mutableStateOf<String?>(null) }
    var hardId by rememberSaveable { mutableStateOf<String?>(null) }
    var shrinkId by rememberSaveable { mutableStateOf<String?>(null) }
    var expanded by rememberSaveable { mutableStateOf(listOf<String>()) }

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

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // At a glance: real weekly counts, or a plain "not enough data".
        val weekly = tasksCompletedPerWeek(s.tasks, s.today)
        if (weekly.size >= MIN_POINTS) {
            LifeCard {
                Text("Tasks completed per week", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(6.dp))
                BarChart(weekly.map { (week, n) -> week.format(DateTimeFormatter.ofPattern("d MMM")) to n.toDouble() }, { "${it.toInt()} done" })
                Muted("${weekly.sumOf { it.second }} completed in the last 8 weeks. Steps are not counted.", Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall)
            }
        } else {
            // No chart until there is something to chart: one quiet line, not a big empty card.
            Muted("The weekly chart appears once you've finished tasks in two different weeks.", Modifier.padding(start = 4.dp), style = MaterialTheme.typography.bodySmall)
        }

        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (option in TaskFilter.entries) {
                val count = filterTasks(s.tasks, option, s.today).size
                SelectChip(filter == option, if (option == TaskFilter.All || option == TaskFilter.Completed) option.label else "${option.label} · $count", { filter = option })
            }
        }

        val shown = filterTasks(s.tasks, filter, s.today)
        if (shown.isEmpty()) {
            EmptyState(
                Icons.Outlined.TaskAlt,
                when (filter) {
                    TaskFilter.Today -> "Nothing due today"
                    TaskFilter.Earlier -> "Nothing from earlier"
                    TaskFilter.Upcoming -> "Nothing coming up"
                    TaskFilter.Unsorted -> "Nothing unsorted"
                    TaskFilter.Completed -> "Nothing completed yet"
                    TaskFilter.All -> "No tasks yet"
                },
                "Tap Task to add one. Paste a list and each line becomes a task.",
            )
        }
        for (task in shown) {
            val open = task.isOpen()
            SwipeActions(
                start = SwipeAction(if (open) "Done" else "Not done", if (open) Icons.Outlined.TaskAlt else Icons.AutoMirrored.Outlined.Undo, MaterialTheme.colorScheme.primary) { toggle(task) },
                end = if (open) SwipeAction("Tomorrow", Icons.Outlined.EventRepeat, MaterialTheme.colorScheme.tertiary) { move(task, s.today.plusDays(1).toString(), "Moved to tomorrow") } else null,
            ) {
                TaskCard(
                    task = task,
                    today = s.today,
                    steps = stepsOf(task, s.tasks),
                    project = s.projects.firstOrNull { it.id == task.projectId }?.name,
                    expanded = task.id in expanded,
                    timing = s.running?.taskId == task.id,
                    onToggle = { toggle(task) },
                    onOpen = { openId = task.id },
                    onLongPress = { actionsId = task.id },
                    onExpand = { expanded = if (task.id in expanded) expanded - task.id else expanded + task.id },
                    onStep = { step -> model.setDone(step, step.isOpen()) },
                )
            }
        }
        if (shown.isNotEmpty()) Muted("Swipe right to finish, left for tomorrow. Hold a task for more.", Modifier.padding(start = 4.dp, top = 6.dp), style = MaterialTheme.typography.bodySmall)
    }

    s.tasks.firstOrNull { it.id == openId }?.let { task ->
        TaskEditor(
            task = task,
            steps = stepsOf(task, s.tasks),
            projects = s.projects, goals = s.goals, capabilities = s.capabilities,
            presetDue = null,
            save = { draft -> model.save(task, draft); openId = null },
            close = { openId = null },
            delete = { delete(task); openId = null },
            toggleStep = { model.setDone(it, it.isOpen()) },
            addStep = { model.addStep(task, it) },
            removeStep = { model.delete(it) },
            moveStep = { step, by -> model.moveStep(task, step, by) },
            newProject = { name, then -> model.newProject(name, then) },
            newGoal = { name, then -> model.newGoal(name, then) },
            newCapability = { name, then -> model.newCapability(name, then) },
        )
    }
    s.tasks.firstOrNull { it.id == actionsId }?.let { task ->
        QuickActions(
            task, s.today, timing = s.running?.taskId == task.id, close = { actionsId = null },
            open = { actionsId = null; openId = task.id },
            move = { date, message -> move(task, date, message); actionsId = null },
            timer = { if (s.running?.taskId == task.id) model.stopTimer() else model.startTimer(task); actionsId = null },
            hard = { actionsId = null; hardId = task.id },
            duplicate = { model.duplicate(task); toast("Copied “${task.title}”"); actionsId = null },
            delete = { delete(task); actionsId = null },
        )
    }
    s.tasks.firstOrNull { it.id == hardId }?.let { task ->
        StuckHelperSheet(
            task,
            close = { hardId = null },
            shrink = { shrinkId = task.id; hardId = null },
            sprint = { model.startTimer(task); toast("Timing it. Stopping after a few minutes is fine."); hardId = null },
            moveTo = { model.moveTo(task, it); hardId = null },
            addStep = { model.addStep(task, it); hardId = null },
            setStatus = { status ->
                model.save(task, TaskDraft(task.title, task.description, status, task.priority, task.startDate, task.dueDate, task.dueTime, task.maxDate, task.energy, task.repeat, task.estimatedMinutes?.toDouble(), "minutes", task.projectId, task.capabilityId, task.goalId))
                hardId = null
            },
            together = { hardId = null },
        )
    }
    s.tasks.firstOrNull { it.id == shrinkId }?.let { task ->
        ShrinkItSheet(task, stepsOf(task, s.tasks).size, add = { title, _ -> model.addStep(task, title) }, close = { shrinkId = null })
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TaskCard(
    task: Task, today: LocalDate, steps: List<Task>, project: String?, expanded: Boolean, timing: Boolean,
    onToggle: () -> Unit, onOpen: () -> Unit, onLongPress: () -> Unit, onExpand: () -> Unit, onStep: (Task) -> Unit,
) {
    val haptics = rememberHaptics()
    val done = !task.isOpen()
    val tint by animateColorAsState(if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, label = "check")
    LifeCard(Modifier.animateContentSize(), onClick = onOpen, onLongClick = onLongPress, contentPadding = PaddingValues(start = 4.dp, end = 14.dp, top = 6.dp, bottom = 8.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            IconButton(onClick = { if (!done) haptics.confirm() else haptics.tick(); onToggle() }) {
                Icon(if (done) Icons.Filled.CheckCircle else Icons.Outlined.Circle, if (done) "Mark “${task.title}” not done" else "Finish “${task.title}”", tint = tint, modifier = Modifier.size(26.dp))
            }
            Column(Modifier.weight(1f).padding(top = 10.dp)) {
                Text(
                    task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    textDecoration = if (done) TextDecoration.LineThrough else null,
                    color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (task.status != "todo" && task.status != "completed") StatusBadge(TASK_STATUSES.firstOrNull { it.first == task.status }?.second ?: task.status)
                    PriorityBadge(task.priority)
                    if (timing) StatusBadge("Timing")
                    val due = dueDetail(task, today) ?: task.dueDate?.let { d -> LocalDate.parse(d.take(10)).format(DateTimeFormatter.ofPattern("d MMM")) }
                    listOfNotNull(due, project).joinToString(" · ").takeIf { it.isNotEmpty() }?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
                }
                if (steps.isNotEmpty()) {
                    Row(Modifier.clickable { haptics.tick(); onExpand() }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Muted("${steps.count { !it.isOpen() }} of ${steps.size} steps done · ${if (expanded) "Hide steps" else "Show steps"}", style = MaterialTheme.typography.bodySmall)
                    }
                    AnimatedVisibility(expanded) {
                        Column {
                            for (step in steps) {
                                Row(Modifier.fillMaxWidth().clickable { if (step.isOpen()) haptics.confirm() else haptics.tick(); onStep(step) }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(if (step.isOpen()) Icons.Outlined.Circle else Icons.Filled.CheckCircle, null, Modifier.size(18.dp), tint = if (step.isOpen()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
                                    Spacer(Modifier.width(8.dp))
                                    Text(step.title, style = MaterialTheme.typography.bodyMedium, textDecoration = if (step.isOpen()) null else TextDecoration.LineThrough)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** A quiet word in a rounded outline (a task's status, "Timing"). */
@Composable
fun StatusBadge(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** Long-press: everything you'd do without opening the task. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickActions(
    task: Task, today: LocalDate, timing: Boolean, close: () -> Unit, open: () -> Unit, move: (String?, String) -> Unit,
    timer: () -> Unit, hard: () -> Unit, duplicate: () -> Unit, delete: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState()) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 12.dp)) {
            Text(task.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
            HorizontalDivider()
            ActionRow("Open", Icons.Outlined.TaskAlt, onClick = open)
            if (task.isOpen()) {
                ActionRow(if (timing) "Stop the timer" else "Start a timer", if (timing) Icons.Outlined.Stop else Icons.Outlined.PlayArrow, onClick = timer)
                ActionRow("This feels hard", Icons.Outlined.ContentCut, onClick = hard)
                ActionRow("Tomorrow", Icons.Outlined.EventRepeat) { move(today.plusDays(1).toString(), "Moved to tomorrow") }
                ActionRow("Next week", Icons.Outlined.DateRange) { move(today.plusWeeks(1).toString(), "Moved to next week") }
                if (task.dueDate != null) ActionRow("Remove the date", Icons.Outlined.EventBusy) { move(null, "Date removed") }
            }
            ActionRow("Duplicate", Icons.Outlined.ContentCopy, onClick = duplicate)
            ActionRow("Delete", Icons.Outlined.Delete, danger = true, onClick = delete)
        }
    }
}

@Composable
fun ActionRow(label: String, icon: ImageVector, danger: Boolean = false, onClick: () -> Unit) {
    val haptics = rememberHaptics()
    val color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    TextButton(onClick = { haptics.tick(); onClick() }, modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.small, contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp)) {
        Icon(icon, null, tint = color)
        Spacer(Modifier.width(16.dp))
        Text(label, color = color, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
    }
}

/** Quick add: type one, or paste a list and each line becomes a task (the web's QuickAddTask). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTaskSheet(today: LocalDate, close: () -> Unit, addMany: (List<String>, String?) -> Unit) {
    val haptics = rememberHaptics()
    val focus = remember { FocusRequester() }
    var text by rememberSaveable { mutableStateOf("") }
    var due by rememberSaveable { mutableStateOf<String?>(today.toString()) }
    var added by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val lines = splitTaskLines(text)

    fun submit() {
        if (lines.isEmpty()) {
            haptics.reject()
            return
        }
        haptics.confirm()
        addMany(lines, due)
        added += lines.size
        text = ""
    }

    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("New task", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("What needs doing? Paste a list for several.") },
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp, max = 220.dp).focusRequester(focus),
            )
            DateChoice(due, { due = it })
            AnimatedVisibility(added > 0) { Muted(if (added == 1) "Added. Type the next one, or close." else "$added added.") }
            Button(onClick = ::submit, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                Text(if (lines.size > 1) "Add ${lines.size} tasks" else "Add")
            }
        }
    }
}
