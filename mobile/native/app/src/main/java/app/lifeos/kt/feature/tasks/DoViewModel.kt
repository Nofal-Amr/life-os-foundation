package app.lifeos.kt.feature.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.model.Capability
import app.lifeos.kt.core.model.Evidence
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.data.CapabilityRepository
import app.lifeos.kt.data.Created
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.TimerRepository
import app.lifeos.kt.data.logic.Plan
import app.lifeos.kt.data.newId
import app.lifeos.kt.data.postponed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class DoState(
    val today: LocalDate,
    val tasks: List<Task>,
    val projects: List<Project>,
    val goals: List<Goal>,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
    val capabilities: List<Capability>,
    val evidence: List<Evidence>,
    val running: TimeEntry?,
    val entries: List<TimeEntry>,
)

@HiltViewModel
class DoViewModel @Inject constructor(
    private val tasks: TaskRepository,
    private val plan: PlanRepository,
    private val caps: CapabilityRepository,
    private val timers: TimerRepository,
) : ViewModel() {
    private val planFlow = combine(plan.projects, plan.goals, plan.habits, plan.habitLogs) { p, g, h, l -> listOf(p, g, h, l) }
    private val capFlow = combine(caps.capabilities, caps.evidence, timers.entries) { c, e, t -> Triple(c, e, t) }

    @Suppress("UNCHECKED_CAST")
    val state: StateFlow<DoState?> = combine(tasks.tasks, planFlow, capFlow) { t, p, (c, e, entries) ->
        DoState(
            LocalDate.now(), t, p[0] as List<Project>, p[1] as List<Goal>, p[2] as List<Habit>, p[3] as List<HabitLog>,
            c, e, entries.filter { it.endedAt == null }.maxByOrNull { it.startedAt }, entries,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /* ------------------------------- tasks ------------------------------- */

    private val created = mutableMapOf<String, Created>()

    fun setDone(task: Task, done: Boolean) = viewModelScope.launch { created[task.id] = tasks.setDone(task, done) }
    fun restore(task: Task) = viewModelScope.launch {
        tasks.restore(task)
        created.remove(task.id)?.let { tasks.discard(it) }
    }
    fun moveTo(task: Task, date: String?) = viewModelScope.launch { tasks.moveTo(task, date) }
    fun delete(task: Task) = viewModelScope.launch { tasks.delete(task) }
    fun addMany(titles: List<String>, due: String?) = viewModelScope.launch { titles.forEach { tasks.add(it, due) } }
    fun duplicate(task: Task) = viewModelScope.launch { tasks.duplicate(task, app.lifeos.kt.data.logic.stepsOf(task, state.value?.tasks.orEmpty())) }

    /** Saves the editor; a later due date is recorded as a postponement, as on the web. */
    fun save(before: Task?, draft: TaskDraft) = viewModelScope.launch {
        if (before == null) {
            tasks.save(draft.applyTo(Task(id = newId(), title = draft.title)))
        } else {
            val after = draft.applyTo(before)
            tasks.save(if (after.dueDate != before.dueDate) postponed(after.copy(dueDate = before.dueDate), after.dueDate) else after)
        }
    }

    fun addStep(parent: Task, title: String) = viewModelScope.launch {
        val position = (state.value?.tasks?.filter { it.parentTaskId == parent.id }?.maxOfOrNull { it.position } ?: -1) + 1
        tasks.save(Task(id = newId(), title = title, parentTaskId = parent.id, status = "todo", position = position, projectId = parent.projectId))
    }

    /** Moves a step up or down one place, renumbering the rest. */
    fun moveStep(parent: Task, step: Task, by: Int) = viewModelScope.launch {
        val steps = app.lifeos.kt.data.logic.stepsOf(parent, state.value?.tasks.orEmpty()).toMutableList()
        val from = steps.indexOfFirst { it.id == step.id }
        val to = (from + by).coerceIn(0, steps.lastIndex)
        if (from < 0 || from == to) return@launch
        steps.add(to, steps.removeAt(from))
        steps.forEachIndexed { index, s -> if (s.position != index) tasks.save(s.copy(position = index)) }
    }

    fun startTimer(task: Task) = viewModelScope.launch { timers.start(task.id, task.title, state.value?.entries.orEmpty()) }
    fun stopTimer() = viewModelScope.launch { state.value?.running?.let { timers.stop(it) } }

    /* ------------------------ projects, goals, habits ------------------------ */

    fun save(project: Project) = viewModelScope.launch { plan.save(project) }
    fun delete(project: Project) = viewModelScope.launch { plan.delete(project) }
    fun save(goal: Goal) = viewModelScope.launch { plan.save(goal) }
    fun delete(goal: Goal) = viewModelScope.launch { plan.delete(goal) }
    fun save(habit: Habit) = viewModelScope.launch { plan.save(habit) }
    fun delete(habit: Habit) = viewModelScope.launch { plan.delete(habit) }
    fun toggleHabit(habit: Habit) = viewModelScope.launch {
        val s = state.value ?: return@launch
        plan.toggleHabit(habit, s.today.toString(), s.habitLogs)
    }
    fun save(capability: Capability) = viewModelScope.launch { caps.save(capability) }
    fun delete(capability: Capability) = viewModelScope.launch { caps.delete(capability) }
    fun linkEvidence(task: Task, capabilityId: String?, note: String?) = viewModelScope.launch { caps.linkEvidence(task, capabilityId, note, state.value?.evidence.orEmpty()) }

    fun newProject(name: String, then: (String) -> Unit = {}) = viewModelScope.launch {
        val p = Project(newId(), name, status = "active")
        plan.save(p)
        then(p.id)
    }
    fun newGoal(name: String, then: (String) -> Unit = {}) = viewModelScope.launch {
        val g = Goal(newId(), name, status = "active")
        plan.save(g)
        then(g.id)
    }
    fun newCapability(name: String, then: (String) -> Unit = {}) = viewModelScope.launch {
        val c = Capability(newId(), name)
        caps.save(c)
        then(c.id)
    }

    fun startPlan(p: Plan, done: (Int) -> Unit) = viewModelScope.launch { done(plan.startPlan(p, LocalDate.now())) }
}
