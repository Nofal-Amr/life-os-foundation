package app.lifeos.kt.data

import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

enum class TaskGroup(val label: String) {
    Late("Late"),
    Today("Today"),
    Upcoming("Coming up"),
    NoDate("No date"),
    DoneToday("Done today"),
}

private val OPEN = setOf("inbox", "todo", "in_progress", "waiting")

fun TaskEntity.isOpen() = status in OPEN

/**
 * Top-level tasks (steps stay with their task) in the order to look at them:
 * late, today, coming up, no date, then what was finished today so it can be undone.
 */
fun groupTasks(
    tasks: List<TaskEntity>,
    today: LocalDate,
    zone: ZoneId = ZoneId.systemDefault(),
): List<Pair<TaskGroup, List<TaskEntity>>> {
    val order = compareBy<TaskEntity>({ it.dueDate ?: "9999" }, { it.dueTime ?: "99" }, { it.title.lowercase() })
    val todayText = today.toString()
    val groups = linkedMapOf<TaskGroup, MutableList<TaskEntity>>()
    for (task in tasks.filter { it.parentTaskId == null }.sortedWith(order)) {
        val group = when {
            !task.isOpen() -> if (task.status == "completed" && completedOn(task, zone) == today) TaskGroup.DoneToday else null
            task.dueDate == null -> TaskGroup.NoDate
            task.dueDate < todayText -> TaskGroup.Late
            task.dueDate == todayText -> TaskGroup.Today
            else -> TaskGroup.Upcoming
        } ?: continue
        groups.getOrPut(group) { mutableListOf() } += task
    }
    return TaskGroup.entries.mapNotNull { group -> groups[group]?.let { group to it } }
}

/** The line under a task's title: how late, what time, or when. */
fun dueDetail(task: TaskEntity, today: LocalDate): String? {
    val due = task.dueDate?.let(LocalDate::parse) ?: return null
    val time = task.dueTime?.take(5)
    val days = ChronoUnit.DAYS.between(today, due)
    return when {
        !task.isOpen() -> null
        days < 0 -> if (days == -1L) "1 day late" else "${-days} days late"
        days == 0L -> time ?: "Today"
        days == 1L -> "Tomorrow" + (time?.let { " · $it" } ?: "")
        days < 7 -> due.format(DateTimeFormatter.ofPattern("EEEE")) + (time?.let { " · $it" } ?: "")
        else -> due.format(DateTimeFormatter.ofPattern("d MMM"))
    }
}

private fun completedOn(task: TaskEntity, zone: ZoneId): LocalDate? = try {
    task.completedAt?.let { OffsetDateTime.parse(it).atZoneSameInstant(zone).toLocalDate() }
} catch (e: Exception) {
    null
}
