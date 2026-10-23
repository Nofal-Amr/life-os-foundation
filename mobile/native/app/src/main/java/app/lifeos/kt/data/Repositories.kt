package app.lifeos.kt.data

import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.CalendarEvent
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
import kotlinx.coroutines.flow.map

fun newId(): String = UUID.randomUUID().toString()

@Singleton
class TaskRepository @Inject constructor(private val store: LocalStore) {
    val tasks: Flow<List<Task>> = store.observe("tasks", Task.serializer())

    suspend fun add(title: String, dueDate: String?, projectId: String? = null, parentTaskId: String? = null) =
        save(Task(id = newId(), title = title.trim(), dueDate = dueDate, projectId = projectId, parentTaskId = parentTaskId))

    suspend fun setDone(task: Task, done: Boolean) = save(
        task.copy(status = if (done) "completed" else "todo", completedAt = if (done) nowIso() else null),
    )

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

    suspend fun save(transaction: Transaction) = store.save("transactions", Transaction.serializer(), transaction)
    suspend fun delete(transaction: Transaction) = store.delete("transactions", transaction.id)
}

@Singleton
class BodyRepository @Inject constructor(private val store: LocalStore) {
    val healthLogs: Flow<List<HealthLog>> = store.observe("health_logs", HealthLog.serializer())
    val medications: Flow<List<Medication>> = store.observe("medications", Medication.serializer())

    suspend fun save(log: HealthLog) = store.save("health_logs", HealthLog.serializer(), log)
}

@Singleton
class SpiritRepository @Inject constructor(private val store: LocalStore) {
    val settings: Flow<PrayerSettings?> = store.observe("prayer_settings", PrayerSettings.serializer()).map { it.firstOrNull() }
    val logs: Flow<List<PrayerLog>> = store.observe("prayer_logs", PrayerLog.serializer())

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
}

@Singleton
class PreferencesRepository @Inject constructor(store: LocalStore) {
    val preferences: Flow<UserPreferences?> = store.observe("user_preferences", UserPreferences.serializer()).map { it.firstOrNull() }
}
