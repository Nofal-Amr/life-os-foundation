package app.lifeos.kt.feature.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.AccountPocket
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.core.model.DailyReview
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.core.model.MedicationLog
import app.lifeos.kt.core.model.PaydayConfig
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.core.model.Profile
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.core.model.UserPreferences
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.TimerRepository
import app.lifeos.kt.data.TodayRepository
import app.lifeos.kt.data.logic.BeforePayday
import app.lifeos.kt.data.logic.ComingUp
import app.lifeos.kt.data.logic.DEFAULT_DIMENSION_ORDER
import app.lifeos.kt.data.logic.DayLine
import app.lifeos.kt.data.logic.Dose
import app.lifeos.kt.data.logic.HubLine
import app.lifeos.kt.data.logic.NextAction
import app.lifeos.kt.data.logic.PrayerSlot
import app.lifeos.kt.data.logic.RingSegment
import app.lifeos.kt.data.logic.StuckTask
import app.lifeos.kt.data.logic.TaskGroup
import app.lifeos.kt.data.logic.availableBeforePayday
import app.lifeos.kt.data.logic.comingUp
import app.lifeos.kt.data.logic.dayLines
import app.lifeos.kt.data.logic.dosesFor
import app.lifeos.kt.data.logic.energyCapacity
import app.lifeos.kt.data.logic.fitsEnergy
import app.lifeos.kt.data.logic.focusGroup
import app.lifeos.kt.data.logic.hasPaydaySetup
import app.lifeos.kt.data.logic.hubLines
import app.lifeos.kt.data.logic.isOpen
import app.lifeos.kt.data.logic.nextActions
import app.lifeos.kt.data.logic.nextPayday
import app.lifeos.kt.data.logic.prayedToday
import app.lifeos.kt.data.logic.prayerTimes
import app.lifeos.kt.data.logic.previousPayday
import app.lifeos.kt.data.logic.stuckTasks
import app.lifeos.kt.data.logic.todayRing
import app.lifeos.kt.data.logic.topLevel
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString

/** A running focus session (kept on this phone, as the web keeps it in the browser). */
@Serializable
data class FocusSession(val startedAt: Long, val minutes: Int, val habitId: String? = null, val habitName: String? = null)

/** A row in "Today's focus": a task (or its first step), grouped by when. */
data class FocusRow(val action: NextAction, val group: TaskGroup, val project: Project?)

data class MoneyStrip(val ready: Boolean, val payday: LocalDate?, val lastPayday: LocalDate?, val totals: BeforePayday)

data class TodayState(
    val today: LocalDate,
    val firstName: String?,
    val ring: List<RingSegment>,
    val primary: NextAction?,
    val fromEarlier: Int,
    val capacityFit: Boolean,
    val stuck: StuckTask?,
    val counts: List<Pair<String, Int>>,
    val focus: List<FocusRow>,
    val hub: List<HubLine>,
    val review: DailyReview?,
    val prayerTimes: List<PrayerSlot>?,
    val city: String?,
    val prayerLogs: List<PrayerLog>,
    val prayedToday: Int,
    val doses: List<Dose>,
    val healthLogged: Boolean,
    val calories: Int?,
    val money: MoneyStrip,
    val formatter: MoneyFormatter,
    val comingUp: List<ComingUp>,
    val soFar: List<DayLine>,
    val running: TimeEntry?,
    val focusSession: FocusSession?,
    val habits: List<Habit>,
    // Kept for the sheets that change things.
    val allTasks: List<Task>,
    val allReviews: List<DailyReview>,
    val medicationLogs: List<MedicationLog>,
    val timeEntries: List<TimeEntry>,
)

private data class Base(
    val tasks: List<Task>, val projects: List<Project>, val goals: List<Goal>, val habits: List<Habit>, val habitLogs: List<HabitLog>,
)
private data class Money(
    val accounts: List<Account>, val transactions: List<Transaction>, val categories: List<FinanceCategory>,
    val pockets: List<AccountPocket>, val recurring: List<RecurringCost>, val payday: PaydayConfig?,
)
private data class Body(
    val health: List<HealthLog>, val meds: List<Medication>, val medLogs: List<MedicationLog>, val food: List<FoodLog>,
)
private data class Misc(
    val settings: PrayerSettings?, val prayerLogs: List<PrayerLog>, val reviews: List<DailyReview>, val profile: Profile?,
    val prefs: UserPreferences?, val reminders: List<Reminder>, val events: List<CalendarEvent>,
    val timeEntries: List<TimeEntry>, val focus: String?, val snoozes: String?,
)

private fun <A, B, C, D, E, F, R> combine6(a: Flow<A>, b: Flow<B>, c: Flow<C>, d: Flow<D>, e: Flow<E>, f: Flow<F>, block: (A, B, C, D, E, F) -> R): Flow<R> =
    combine(combine(a, b, c) { x, y, z -> Triple(x, y, z) }, combine(d, e, f) { x, y, z -> Triple(x, y, z) }) { (x, y, z), (u, v, w) -> block(x, y, z, u, v, w) }

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val tasks: TaskRepository,
    money: MoneyRepository,
    private val spirit: SpiritRepository,
    private val plan: PlanRepository,
    planner: PlannerRepository,
    body: BodyRepository,
    private val today: TodayRepository,
    private val timers: TimerRepository,
    prefs: PreferencesRepository,
    private val settings: AppSettings,
) : ViewModel() {
    private val json = Json { ignoreUnknownKeys = true }

    private val base = combine(tasks.tasks, plan.projects, plan.goals, plan.habits, plan.habitLogs) { t, p, g, h, l -> Base(t, p, g, h, l) }
    private val moneyFlow = combine6(money.accounts, money.transactions, money.categories, today.pockets, today.recurring, today.payday) { a, t, c, p, r, d -> Money(a, t, c, p, r, d) }
    private val bodyFlow = combine(body.healthLogs, body.medications, today.medicationLogs, today.foodLogs) { h, m, l, f -> Body(h, m, l, f) }
    private val misc = combine(
        combine6(spirit.settings, spirit.logs, today.reviews, today.profile, prefs.preferences, planner.reminders) { s, l, r, p, pr, rem -> listOf(s, l, r, p, pr, rem) },
        combine(planner.events, timers.entries, settings.focusSession, settings.stuckSnoozes) { e, t, f, s -> listOf(e, t, f, s) },
    ) { a, b ->
        @Suppress("UNCHECKED_CAST")
        Misc(
            a[0] as PrayerSettings?, a[1] as List<PrayerLog>, a[2] as List<DailyReview>, a[3] as Profile?, a[4] as UserPreferences?,
            a[5] as List<Reminder>, b[0] as List<CalendarEvent>, b[1] as List<TimeEntry>, b[2] as String?, b[3] as String?,
        )
    }

    val state: StateFlow<TodayState?> = combine(base, moneyFlow, bodyFlow, misc) { b, m, bd, x -> build(b, m, bd, x) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private fun build(b: Base, m: Money, bd: Body, x: Misc): TodayState {
        val day = LocalDate.now()
        val t = day.toString()
        val formatter = MoneyFormatter(x.prefs?.currency)
        val review = x.reviews.firstOrNull { it.reviewDate == t }
        val capacity = energyCapacity(review?.energy)
        val actions = nextActions(b.tasks, day, capacity)
        val primary = actions.firstOrNull()
        val snoozed = runCatching { json.decodeFromString<Map<String, String>>(x.snoozes ?: "{}") }.getOrDefault(emptyMap())
        val stuck = stuckTasks(b.tasks, day).firstOrNull { it.task.id != primary?.parent?.id && snoozed[it.task.id] != t }
        val top = topLevel(b.tasks)
        val fromEarlier = top.count { it.isOpen() && it.dueDate != null && it.dueDate < t }
        val projectById = b.projects.associateBy { it.id }
        val focus = actions.drop(1).mapNotNull { action ->
            focusGroup(action.parent.dueDate, day)?.let { FocusRow(action, it, action.parent.projectId?.let(projectById::get)) }
        }.take(6)
        val doses = dosesFor(day, bd.meds, bd.medLogs)
        val prayed = prayedToday(x.prayerLogs, day)
        val config = m.payday
        val payday = nextPayday(config, day)
        val totals = availableBeforePayday(m.accounts, m.transactions, m.recurring, payday, config?.safetyBuffer, m.pockets)
        val dateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")
        val fmtDate = { iso: String -> runCatching { LocalDate.parse(iso.take(10)).format(dateFormat) }.getOrDefault(iso) }
        val todaysFood = bd.food.filter { it.logDate == t }
        val habitsTicked = b.habitLogs.count { it.logDate == t }
        return TodayState(
            today = day,
            firstName = x.profile?.displayName?.trim()?.split(Regex("\\s+"))?.firstOrNull()?.ifEmpty { null },
            ring = todayRing(day, b.tasks, b.habits, b.habitLogs, prayed, if (doses.isNotEmpty()) doses.count { it.taken } to doses.size else null),
            primary = primary,
            fromEarlier = fromEarlier,
            capacityFit = capacity != null && primary?.parent?.energy != null && fitsEnergy(primary.parent, capacity),
            stuck = stuck,
            counts = listOf(
                "Unsorted" to top.count { it.status == "inbox" },
                "Due today" to top.count { it.isOpen() && it.dueDate == t },
                "From earlier" to fromEarlier,
                "Active projects" to b.projects.count { it.status == "active" },
            ),
            focus = focus,
            hub = hubLines(day, b.tasks, x.prayerLogs, bd.meds, bd.medLogs, b.habits, b.habitLogs, m.transactions),
            review = review,
            prayerTimes = prayerTimes(x.settings, day),
            city = x.settings?.city,
            prayerLogs = x.prayerLogs,
            prayedToday = prayed,
            doses = doses,
            healthLogged = bd.health.any { it.logDate == t },
            calories = if (todaysFood.isEmpty()) null else todaysFood.sumOf { it.calories }.toInt(),
            money = MoneyStrip(hasPaydaySetup(config), payday, previousPayday(config, day), totals),
            formatter = formatter,
            comingUp = comingUp(day, b.tasks, b.projects, b.goals, m.recurring, payday, x.reminders, formatter::format, fmtDate, x.prefs?.dimensionOrder?.takeIf { it.isNotEmpty() } ?: DEFAULT_DIMENSION_ORDER),
            soFar = dayLines(day, b.tasks, m.transactions, m.categories, bd.food, bd.meds, bd.medLogs, bd.health.firstOrNull { it.logDate == t }, prayed, habitsTicked, formatter::format),
            running = x.timeEntries.filter { it.endedAt == null }.maxByOrNull { it.startedAt },
            focusSession = x.focus?.let { runCatching { json.decodeFromString(FocusSession.serializer(), it) }.getOrNull() },
            habits = b.habits.filter { it.active },
            allTasks = b.tasks,
            allReviews = x.reviews,
            medicationLogs = bd.medLogs,
            timeEntries = x.timeEntries,
        )
    }

    /* ------------------------------ actions ------------------------------ */

    private val created = mutableMapOf<String, app.lifeos.kt.data.Created>()
    fun finish(task: Task) = viewModelScope.launch { created[task.id] = tasks.setDone(task, true) }
    fun add(title: String, due: String?) = viewModelScope.launch { tasks.add(title, due) }
    /** Undo: the task as it was, and whatever finishing it created (its evidence, the next repeat). */
    fun restore(task: Task) = viewModelScope.launch {
        tasks.restore(task)
        created.remove(task.id)?.let { tasks.discard(it) }
    }

    fun setPrayer(name: String, status: String?) = viewModelScope.launch {
        val s = state.value ?: return@launch
        spirit.setStatus(s.today.toString(), name, status, s.prayerLogs)
    }

    fun setDose(dose: Dose) = viewModelScope.launch {
        val s = state.value ?: return@launch
        today.setDose(dose.medication.id, s.today.toString(), dose.slot, !dose.taken, s.medicationLogs)
    }

    fun setMood(value: Int?) = viewModelScope.launch {
        val s = state.value ?: return@launch
        today.saveCheckIn(s.today.toString(), s.allReviews) { it.copy(mood = value) }
    }

    fun setEnergy(value: Int?) = viewModelScope.launch {
        val s = state.value ?: return@launch
        today.saveCheckIn(s.today.toString(), s.allReviews) { it.copy(energy = value) }
    }

    fun snoozeStuck(taskId: String) = viewModelScope.launch {
        val day = LocalDate.now().toString()
        // Only today's snoozes are kept.
        settings.setStuckSnoozes(json.encodeToString(mapOf(taskId to day)))
    }

    fun startTimer(task: Task?, label: String) = viewModelScope.launch {
        timers.start(task?.id, label, state.value?.timeEntries.orEmpty())
    }

    fun stopTimer() = viewModelScope.launch {
        state.value?.running?.let { timers.stop(it) }
        settings.setFocusSession(null)
    }

    /** One thing, for a set time; its minutes are logged like any timer, and a chosen habit is ticked when it ends. */
    fun startFocus(task: Task?, label: String, minutes: Int, habit: Habit?) = viewModelScope.launch {
        timers.start(task?.id, label.ifBlank { task?.title ?: "Focus" }, state.value?.timeEntries.orEmpty())
        settings.setFocusSession(json.encodeToString(FocusSession.serializer(), FocusSession(System.currentTimeMillis(), minutes, habit?.id, habit?.name)))
    }

    /** The focus time is up: stop the timer and tick the habit it was for. */
    fun finishFocus() = viewModelScope.launch {
        val s = state.value ?: return@launch
        val session = s.focusSession ?: return@launch
        s.running?.let { timers.stop(it) }
        session.habitId?.let { id ->
            s.habits.firstOrNull { it.id == id }?.let { habit ->
                plan.markHabitDone(habit, s.today.toString())
            }
        }
        settings.setFocusSession(null)
    }

    /** "This feels hard": the moves from the web's helper. */
    fun moveTo(task: Task, date: String) = viewModelScope.launch { tasks.moveTo(task, date) }
    fun setStatus(task: Task, status: String) = viewModelScope.launch { tasks.save(task.copy(status = status, completedAt = if (status == "completed") nowIso() else task.completedAt)) }
    fun addStep(parent: Task, title: String, minutes: Int?) = viewModelScope.launch {
        tasks.save(Task(id = newId(), title = title.trim(), parentTaskId = parent.id, status = "todo", position = 0, estimatedMinutes = minutes, estimateUnit = "minutes", projectId = parent.projectId))
    }
}
