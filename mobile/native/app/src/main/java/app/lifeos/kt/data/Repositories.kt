package app.lifeos.kt.data

import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.BodyStats
import app.lifeos.kt.core.model.DhikrLog
import app.lifeos.kt.core.model.Food
import app.lifeos.kt.core.model.AccountPocket
import app.lifeos.kt.core.model.DailyReview
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.MedicationLog
import app.lifeos.kt.core.model.PaydayConfig
import app.lifeos.kt.core.model.Profile
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.core.model.Capability
import app.lifeos.kt.core.model.Evidence
import app.lifeos.kt.data.logic.nextRepeatDate
import app.lifeos.kt.data.logic.STARTER_CATEGORIES
import app.lifeos.kt.data.logic.advanceDate
import app.lifeos.kt.data.logic.legacyFrequency
import app.lifeos.kt.data.logic.recurringInterval
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.core.model.UserPreferences
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlin.math.abs

fun newId(): String = UUID.randomUUID().toString()

@Singleton
class TaskRepository @Inject constructor(private val store: LocalStore) {
    val tasks: Flow<List<Task>> = store.observe("tasks", Task.serializer())

    suspend fun add(title: String, dueDate: String?, projectId: String? = null, parentTaskId: String? = null) =
        save(Task(id = newId(), title = title.trim(), dueDate = dueDate, projectId = projectId, parentTaskId = parentTaskId))

    /**
     * Finishing a task (as the web does): its evidence is logged, and a
     * repeating one hands its repeat on to a new task on the next date.
     * Returns what was created, so Undo can take it all back.
     */
    suspend fun setDone(task: Task, done: Boolean): Created {
        val created = mutableListOf<Pair<String, String>>()
        if (!done) {
            save(task.copy(status = "todo", completedAt = null))
            return Created(created)
        }
        val repeat = task.repeat?.takeIf { task.parentTaskId == null }
        save(task.copy(status = "completed", completedAt = nowIso(), repeat = if (repeat != null) null else task.repeat))
        val evidence = Evidence(newId(), taskId = task.id, capabilityId = task.capabilityId, projectId = task.projectId, goalId = task.goalId)
        store.save("evidence", Evidence.serializer(), evidence)
        created += "evidence" to evidence.id
        if (repeat != null) {
            val next = Task(
                id = newId(), title = task.title, description = task.description, status = "todo", priority = task.priority,
                dueDate = nextRepeatDate(task.dueDate ?: java.time.LocalDate.now().toString(), repeat), dueTime = task.dueTime, repeat = repeat,
                projectId = task.projectId, capabilityId = task.capabilityId, goalId = task.goalId,
                estimatedMinutes = task.estimatedMinutes, estimateUnit = task.estimateUnit, energy = task.energy,
            )
            save(next)
            created += "tasks" to next.id
        }
        return Created(created)
    }

    /** Takes back what finishing created (Undo). */
    suspend fun discard(created: Created) = created.rows.forEach { (table, id) -> store.delete(table, id) }

    /** A copy starts clean: no dates, no completion, no move history; its steps come along. */
    suspend fun duplicate(task: Task, steps: List<Task>): Task {
        val copy = Task(
            id = newId(), title = task.title, description = task.description, status = if (task.status == "completed") "todo" else task.status,
            priority = task.priority, projectId = task.projectId, capabilityId = task.capabilityId, goalId = task.goalId,
            estimatedMinutes = task.estimatedMinutes, estimateUnit = task.estimateUnit ?: "minutes", energy = task.energy,
        )
        save(copy)
        steps.forEachIndexed { index, step ->
            save(Task(id = newId(), title = step.title, status = "todo", parentTaskId = copy.id, position = index, estimatedMinutes = step.estimatedMinutes, projectId = copy.projectId))
        }
        return copy
    }

    /** A new due date; moving it later is recorded as information only, as the web app does. */
    suspend fun moveTo(task: Task, date: String?) = save(postponed(task, date))

    suspend fun save(task: Task) = store.save("tasks", Task.serializer(), task)
    suspend fun delete(task: Task) = store.delete("tasks", task.id)
    suspend fun restore(task: Task) = store.save("tasks", Task.serializer(), task)
}

/** The web app's postponementPatch: a count, when it last moved, and the date it was first meant for. */
fun postponed(task: Task, nextDue: String?): Task {
    val previous = task.dueDate
    if (nextDue == null || previous == null || nextDue <= previous) return task.copy(dueDate = nextDue)
    return task.copy(
        dueDate = nextDue,
        postponedCount = task.postponedCount + 1,
        lastPostponedAt = nowIso(),
        originalDueDate = task.originalDueDate ?: previous,
    )
}

@Singleton
class PlanRepository @Inject constructor(private val store: LocalStore) {
    val projects: Flow<List<Project>> = store.observe("projects", Project.serializer())
    val goals: Flow<List<Goal>> = store.observe("goals", Goal.serializer())
    val habits: Flow<List<Habit>> = store.observe("habits", Habit.serializer())
    val habitLogs: Flow<List<HabitLog>> = store.observe("habit_logs", HabitLog.serializer())

    suspend fun save(project: Project) = store.save("projects", Project.serializer(), project)
    suspend fun delete(project: Project) = store.delete("projects", project.id)
    suspend fun save(goal: Goal) = store.save("goals", Goal.serializer(), goal)
    suspend fun delete(goal: Goal) = store.delete("goals", goal.id)
    suspend fun save(habit: Habit) = store.save("habits", Habit.serializer(), habit)
    suspend fun delete(habit: Habit) = store.delete("habits", habit.id)

    /** A ready-made plan: an ordinary project and its dated tasks, from today. */
    suspend fun startPlan(plan: app.lifeos.kt.data.logic.Plan, start: java.time.LocalDate): Int {
        val tasks = app.lifeos.kt.data.logic.planTasks(plan, start)
        val project = Project(newId(), plan.name, description = plan.summary, status = "active", startDate = start.toString(), dueDate = tasks.lastOrNull()?.second, icon = plan.icon)
        save(project)
        tasks.forEachIndexed { i, (title, due) -> store.save("tasks", Task.serializer(), Task(newId(), title, status = "todo", dueDate = due, projectId = project.id, position = i)) }
        return tasks.size
    }

    /** Marks a habit done for a day if it isn't already (a finished focus session ticks it). */
    suspend fun markHabitDone(habit: Habit, date: String) {
        if (habitLogs.first().none { it.habitId == habit.id && it.logDate == date }) store.save("habit_logs", HabitLog.serializer(), HabitLog(newId(), habit.id, date))
    }

    /** Marks a habit for a day, or clears the mark. */
    suspend fun toggleHabit(habit: Habit, date: String, logs: List<HabitLog>) {
        val existing = logs.firstOrNull { it.habitId == habit.id && it.logDate == date }
        if (existing != null) store.delete("habit_logs", existing.id)
        else store.save("habit_logs", HabitLog.serializer(), HabitLog(newId(), habit.id, date))
    }
}

@Singleton
class MoneyRepository @Inject constructor(private val store: LocalStore) {
    val accounts: Flow<List<Account>> = store.observe("accounts", Account.serializer())
    val transactions: Flow<List<Transaction>> = store.observe("transactions", Transaction.serializer())
    val categories: Flow<List<FinanceCategory>> = store.observe("finance_categories", FinanceCategory.serializer())
    val pockets: Flow<List<AccountPocket>> = store.observe("account_pockets", AccountPocket.serializer())
    val recurring: Flow<List<RecurringCost>> = store.observe("recurring_costs", RecurringCost.serializer())
    val payday: Flow<PaydayConfig?> = store.observe("payday_config", PaydayConfig.serializer()).map { it.firstOrNull() }

    suspend fun save(transaction: Transaction) = store.save("transactions", Transaction.serializer(), transaction)
    suspend fun delete(transaction: Transaction) = store.delete("transactions", transaction.id)
    suspend fun save(account: Account) = store.save("accounts", Account.serializer(), account)
    suspend fun delete(account: Account) = store.delete("accounts", account.id)
    suspend fun save(pocket: AccountPocket) = store.save("account_pockets", AccountPocket.serializer(), pocket)
    suspend fun delete(pocket: AccountPocket) = store.delete("account_pockets", pocket.id)
    suspend fun save(category: FinanceCategory) = store.save("finance_categories", FinanceCategory.serializer(), category)
    suspend fun delete(category: FinanceCategory) = store.delete("finance_categories", category.id)
    suspend fun save(cost: RecurringCost) = store.save("recurring_costs", RecurringCost.serializer(), cost)
    suspend fun delete(cost: RecurringCost) = store.delete("recurring_costs", cost.id)
    suspend fun save(config: PaydayConfig) = store.save("payday_config", PaydayConfig.serializer(), config)

    /**
     * As the web's logRecurringCost: an expense, then the cost moves to its next
     * date. Paid early, it's dated today (nothing is ever logged in the future);
     * paid late, it keeps the date it was due.
     */
    suspend fun logRecurring(cost: RecurringCost, accountId: String, today: String = java.time.LocalDate.now().toString()): Created {
        val transaction = Transaction(
            id = newId(),
            accountId = accountId,
            amount = -abs(cost.amount),
            kind = "expense",
            categoryId = cost.categoryId,
            date = minOf(cost.nextDueDate.take(10), today),
            description = cost.name,
        )
        store.save("transactions", Transaction.serializer(), transaction)
        skipRecurring(cost)
        return Created(listOf("transactions" to transaction.id))
    }

    /** Moves the cost to its next date; nothing is logged. */
    suspend fun skipRecurring(cost: RecurringCost) {
        val (count, unit) = recurringInterval(cost)
        val next = advanceDate(cost.nextDueDate, count, unit)
        store.save("recurring_costs", RecurringCost.serializer(), cost.copy(nextDueDate = next, nextDueAt = "${next}T00:00:00", frequency = legacyFrequency(unit, count)))
    }

    /** The web's starter labels, skipping any name already there. */
    suspend fun addStarterCategories(existing: List<FinanceCategory>) {
        val names = existing.map { it.name.lowercase() }.toSet()
        for ((name, kind) in STARTER_CATEGORIES) {
            if (name.lowercase() !in names) store.save("finance_categories", FinanceCategory.serializer(), FinanceCategory(newId(), name, kind))
        }
    }

    suspend fun remove(created: Created) = created.rows.forEach { (table, id) -> store.delete(table, id) }
}

@Singleton
class BodyRepository @Inject constructor(private val store: LocalStore) {
    val healthLogs: Flow<List<HealthLog>> = store.observe("health_logs", HealthLog.serializer())
    val medications: Flow<List<Medication>> = store.observe("medications", Medication.serializer())
    val foods: Flow<List<Food>> = store.observe("foods", Food.serializer())
    val bodyStats: Flow<BodyStats?> = store.observe("body_stats", BodyStats.serializer()).map { it.firstOrNull() }

    suspend fun save(log: HealthLog) = store.save("health_logs", HealthLog.serializer(), log)
    suspend fun save(medication: Medication) = store.save("medications", Medication.serializer(), medication)
    suspend fun save(food: Food) = store.save("foods", Food.serializer(), food)
    suspend fun delete(food: Food) = store.delete("foods", food.id)
    suspend fun save(log: FoodLog) = store.save("food_logs", FoodLog.serializer(), log)
    suspend fun delete(log: FoodLog) = store.delete("food_logs", log.id)
    suspend fun save(stats: BodyStats) = store.save("body_stats", BodyStats.serializer(), stats.copy(updatedAt = nowIso()))

    /** As on the web, a medication's daily taken records go with it. */
    suspend fun delete(medication: Medication, logs: List<MedicationLog>) {
        logs.filter { it.medicationId == medication.id }.forEach { store.delete("medication_logs", it.id) }
        store.delete("medications", medication.id)
    }
}

@Singleton
class SpiritRepository @Inject constructor(private val store: LocalStore) {
    val settings: Flow<PrayerSettings?> = store.observe("prayer_settings", PrayerSettings.serializer()).map { it.firstOrNull() }
    val logs: Flow<List<PrayerLog>> = store.observe("prayer_logs", PrayerLog.serializer())
    val dhikr: Flow<List<DhikrLog>> = store.observe("dhikr_logs", DhikrLog.serializer())

    /** Place, method and Asr school; one row per person, as the web upserts it. */
    suspend fun save(settings: PrayerSettings) = store.save("prayer_settings", PrayerSettings.serializer(), settings)

    suspend fun logDhikr(date: String, kind: String, count: Int, label: String? = null): DhikrLog {
        val log = DhikrLog(newId(), date, kind, count, label, nowIso())
        store.save("dhikr_logs", DhikrLog.serializer(), log)
        return log
    }

    suspend fun delete(log: DhikrLog) = store.delete("dhikr_logs", log.id)

    /** Records how a prayer was prayed, or clears it with null; older columns kept in step as the web app does. */
    suspend fun setStatus(date: String, prayer: String, status: String?, logs: List<PrayerLog>) {
        val existing = logs.firstOrNull { it.prayerDate == date && it.prayerName == prayer }
        if (status == null) {
            existing?.let { store.delete("prayer_logs", it.id) }
            return
        }
        val log = (existing ?: PrayerLog(newId(), date, prayer)).copy(
            status = status,
            completed = status != "missed",
            onTime = when (status) {
                "late" -> false
                "missed" -> null
                else -> true
            },
        )
        store.save("prayer_logs", PrayerLog.serializer(), log)
    }
}

@Singleton
class PlannerRepository @Inject constructor(private val store: LocalStore) {
    val events: Flow<List<CalendarEvent>> = store.observe("events", CalendarEvent.serializer())
    val reminders: Flow<List<Reminder>> = store.observe("reminders", Reminder.serializer())
    val notes: Flow<List<Note>> = store.observe("notes", Note.serializer())

    suspend fun save(reminder: Reminder) = store.save("reminders", Reminder.serializer(), reminder)
    suspend fun save(note: Note) = store.save("notes", Note.serializer(), note)
    suspend fun deleteNote(note: Note) = store.delete("notes", note.id)
    suspend fun save(event: CalendarEvent) = store.save("events", CalendarEvent.serializer(), event)
    suspend fun delete(event: CalendarEvent) = store.delete("events", event.id)
}

@Singleton
class PreferencesRepository @Inject constructor(private val store: LocalStore) {
    val preferences: Flow<UserPreferences?> = store.observe("user_preferences", UserPreferences.serializer()).map { it.firstOrNull() }

    /** The usual foods and cuisines (the web's food_prefs), kept beside the other preferences. */
    suspend fun saveFoodPrefs(current: UserPreferences?, value: kotlinx.serialization.json.JsonObject) =
        store.save("user_preferences", UserPreferences.serializer(), (current ?: UserPreferences(newId())).copy(foodPrefs = value))
}

@Singleton
class TodayRepository @Inject constructor(private val store: LocalStore) {
    val pockets: Flow<List<AccountPocket>> = store.observe("account_pockets", AccountPocket.serializer())
    val recurring: Flow<List<RecurringCost>> = store.observe("recurring_costs", RecurringCost.serializer())
    val payday: Flow<PaydayConfig?> = store.observe("payday_config", PaydayConfig.serializer()).map { it.firstOrNull() }
    val medicationLogs: Flow<List<MedicationLog>> = store.observe("medication_logs", MedicationLog.serializer())
    val foodLogs: Flow<List<FoodLog>> = store.observe("food_logs", FoodLog.serializer())
    val reviews: Flow<List<DailyReview>> = store.observe("daily_reviews", DailyReview.serializer())
    val profile: Flow<Profile?> = store.observe("profiles", Profile.serializer()).map { it.firstOrNull() }

    /** Marks a scheduled dose taken, or not (the web keeps one row per medicine, day and time). */
    suspend fun setDose(medicationId: String, date: String, slot: String, taken: Boolean, logs: List<MedicationLog>) {
        val existing = logs.firstOrNull { it.medicationId == medicationId && it.logDate == date && it.timeSlot == slot }
        store.save("medication_logs", MedicationLog.serializer(), (existing ?: MedicationLog(newId(), medicationId, date, slot)).copy(taken = taken))
    }

    /** The two-tap check-in: only mood and/or energy, so a written review for the day is never overwritten. */
    suspend fun saveCheckIn(date: String, reviews: List<DailyReview>, change: (DailyReview) -> DailyReview) {
        val existing = reviews.firstOrNull { it.reviewDate == date } ?: DailyReview(newId(), date)
        store.save("daily_reviews", DailyReview.serializer(), change(existing))
    }
}

@Singleton
class TimerRepository @Inject constructor(private val store: LocalStore) {
    val entries: Flow<List<TimeEntry>> = store.observe("time_entries", TimeEntry.serializer())
    val running: Flow<TimeEntry?> = entries.map { list -> list.filter { it.endedAt == null }.maxByOrNull { it.startedAt } }

    /** Starts timing; whatever was running stops first (one timer at a time, as on the web). */
    suspend fun start(taskId: String?, label: String, all: List<TimeEntry>) {
        all.filter { it.endedAt == null }.forEach { store.save("time_entries", TimeEntry.serializer(), it.copy(endedAt = nowIso())) }
        store.save("time_entries", TimeEntry.serializer(), TimeEntry(newId(), startedAt = nowIso(), taskId = taskId, label = label))
    }

    suspend fun stop(entry: TimeEntry) = store.save("time_entries", TimeEntry.serializer(), entry.copy(endedAt = nowIso()))
}

/** What an action created, so Undo can remove it again. */
data class Created(val rows: List<Pair<String, String>>)

@Singleton
class CapabilityRepository @Inject constructor(private val store: LocalStore) {
    val capabilities: Flow<List<Capability>> = store.observe("capabilities", Capability.serializer())
    val evidence: Flow<List<Evidence>> = store.observe("evidence", Evidence.serializer())

    suspend fun save(capability: Capability) = store.save("capabilities", Capability.serializer(), capability)
    suspend fun delete(capability: Capability) = store.delete("capabilities", capability.id)

    /** "What did this build?": the evidence row for a finished task, with a capability and note. */
    suspend fun linkEvidence(task: Task, capabilityId: String?, note: String?, all: List<Evidence>) {
        val existing = all.firstOrNull { it.taskId == task.id }
        store.save("evidence", Evidence.serializer(), (existing ?: Evidence(newId(), taskId = task.id, projectId = task.projectId, goalId = task.goalId)).copy(capabilityId = capabilityId, note = note))
    }
}
