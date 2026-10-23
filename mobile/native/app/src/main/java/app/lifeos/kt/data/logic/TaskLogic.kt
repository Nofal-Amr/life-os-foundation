package app.lifeos.kt.data.logic

import app.lifeos.kt.core.common.localDateOf
import app.lifeos.kt.core.model.Task
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

enum class TaskGroup(val label: String) {
    Overdue("Overdue"),
    Today("Today"),
    Upcoming("Coming up"),
    NoDate("No date"),
    DoneToday("Done today"),
}

private val OPEN = setOf("inbox", "todo", "in_progress", "waiting")

fun Task.isOpen() = status in OPEN

/**
 * Top-level tasks (steps stay with their task) in the order to look at them:
 * earlier dates, today, coming up, no date, then what was finished today so it can be undone.
 */
fun groupTasks(tasks: List<Task>, today: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<Pair<TaskGroup, List<Task>>> {
    val order = compareBy<Task>({ it.dueDate ?: "9999" }, { it.dueTime ?: "99" }, { it.position }, { it.title.lowercase() })
    val todayText = today.toString()
    val groups = linkedMapOf<TaskGroup, MutableList<Task>>()
    for (task in tasks.filter { it.parentTaskId == null }.sortedWith(order)) {
        val due = task.dueDate
        val group = when {
            !task.isOpen() -> if (task.status == "completed" && localDateOf(task.completedAt, zone) == today) TaskGroup.DoneToday else null
            due == null -> TaskGroup.NoDate
            due < todayText -> TaskGroup.Overdue
            due == todayText -> TaskGroup.Today
            else -> TaskGroup.Upcoming
        } ?: continue
        groups.getOrPut(group) { mutableListOf() } += task
    }
    return TaskGroup.entries.mapNotNull { group -> groups[group]?.let { group to it } }
}

/** The line under a task's title: when it was meant for, what time, or when it's coming. Plain facts. */
fun dueDetail(task: Task, today: LocalDate): String? {
    val due = task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return null
    if (!task.isOpen()) return null
    val time = task.dueTime?.take(5)
    val days = ChronoUnit.DAYS.between(today, due)
    val withTime = { text: String -> text + (time?.let { " · $it" } ?: "") }
    return when {
        days == -1L -> "Yesterday"
        days < 0 -> "From ${due.format(DateTimeFormatter.ofPattern(if (due.year == today.year) "d MMM" else "d MMM yyyy"))}"
        days == 0L -> time ?: "Today"
        days == 1L -> withTime("Tomorrow")
        days < 7 -> withTime(due.format(DateTimeFormatter.ofPattern("EEEE")))
        else -> due.format(DateTimeFormatter.ofPattern("d MMM"))
    }
}

/** The one next thing to do: the oldest dated task first, then today's earliest, then the soonest coming up. */
fun nextAction(tasks: List<Task>): Task? = tasks
    .filter { it.isOpen() && it.parentTaskId == null && it.dueDate != null }
    .minWithOrNull(compareBy({ it.dueDate }, { it.dueTime ?: "99" }))

/** Steps of a task, in order, with how many are done. */
fun stepsOf(task: Task, all: List<Task>): List<Task> =
    all.filter { it.parentTaskId == task.id }.sortedWith(compareBy({ it.position }, { it.createdAt ?: "" }))
