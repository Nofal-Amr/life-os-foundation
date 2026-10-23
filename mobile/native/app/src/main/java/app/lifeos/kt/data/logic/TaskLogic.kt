package app.lifeos.kt.data.logic

import app.lifeos.kt.core.common.localDateOf
import app.lifeos.kt.core.model.Task
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

// Ported from the web app (src/data/tasks.ts, focus.ts, stuck.ts and the
// dashboard). Late things are "from earlier", never red or "overdue".

enum class TaskGroup(val label: String) {
    Earlier("From earlier"),
    Today("Today"),
    Upcoming("Coming up"),
    NoDate("No date"),
    DoneToday("Done today"),
}

private val OPEN = setOf("inbox", "todo", "in_progress", "waiting")

fun Task.isOpen() = status in OPEN

fun topLevel(tasks: List<Task>) = tasks.filter { it.parentTaskId == null }

/** A start date still ahead: the task isn't on the table yet. */
fun notStartedYet(task: Task, today: String) = task.startDate != null && task.startDate.take(10) > today

/**
 * Top-level tasks (steps stay with their task) in the order to look at them:
 * from earlier, today, coming up, no date, then what was finished today so it can be undone.
 */
fun groupTasks(tasks: List<Task>, today: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<Pair<TaskGroup, List<Task>>> {
    val order = compareBy<Task>({ it.dueDate ?: "9999" }, { it.dueTime ?: "99" }, { it.position }, { it.title.lowercase() })
    val todayText = today.toString()
    val groups = linkedMapOf<TaskGroup, MutableList<Task>>()
    for (task in topLevel(tasks).sortedWith(order)) {
        val due = task.dueDate
        val group = when {
            !task.isOpen() -> if (task.status == "completed" && localDateOf(task.completedAt, zone) == today) TaskGroup.DoneToday else null
            due == null -> TaskGroup.NoDate
            due < todayText -> TaskGroup.Earlier
            due == todayText -> TaskGroup.Today
            else -> TaskGroup.Upcoming
        } ?: continue
        groups.getOrPut(group) { mutableListOf() } += task
    }
    return TaskGroup.entries.mapNotNull { group -> groups[group]?.let { group to it } }
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "4 days ago", or a date (the web's relativeDay). */
fun relativeDay(date: String, today: LocalDate): String {
    val d = runCatching { LocalDate.parse(date.take(10)) }.getOrNull() ?: return date
    val days = ChronoUnit.DAYS.between(today, d)
    return when {
        days == 0L -> "Today"
        days == 1L -> "Tomorrow"
        days == -1L -> "Yesterday"
        days in 2..6 -> "In $days days"
        days in -29..-2 -> "${-days} days ago"
        else -> d.format(DateTimeFormatter.ofPattern("d MMM"))
    }
}

/** The line under a task's title: when, and the time if it has one. */
fun dueDetail(task: Task, today: LocalDate): String? {
    val due = task.dueDate ?: return null
    if (!task.isOpen()) return null
    return relativeDay(due, today) + (task.dueTime?.take(5)?.let { " · $it" } ?: "")
}

/** Which focus group a due date belongs to; null when it's further out than [soonDays]. */
fun focusGroup(due: String?, today: LocalDate, soonDays: Int = 3): TaskGroup? {
    val d = due?.take(10) ?: return null
    val t = today.toString()
    return when {
        d < t -> TaskGroup.Earlier
        d == t -> TaskGroup.Today
        ChronoUnit.DAYS.between(today, LocalDate.parse(d)) <= soonDays -> TaskGroup.Upcoming
        else -> null
    }
}

/* ------------------------------ estimates ------------------------------ */

private fun unitMinutes(unit: String?) = when (unit) {
    "hours" -> 60
    "days" -> 1440
    else -> 1
}

private fun unitShort(unit: String?) = when (unit) {
    "hours" -> "h"
    "days" -> "d"
    else -> "min"
}

/** "2 h", "3 d", "45 min": always in the unit chosen, never converted. */
fun estimateLabel(task: Task): String {
    val minutes = task.estimatedMinutes ?: return ""
    val value = Math.round(minutes.toDouble() / unitMinutes(task.estimateUnit) * 100) / 100.0
    val shown = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
    return "$shown ${unitShort(task.estimateUnit)}"
}

/* ------------------------------ energy ------------------------------ */

/** Today's check-in energy (1–5) as the task energy you have (1–3). */
fun energyCapacity(checkIn: Int?): Int? = when {
    checkIn == null || checkIn == 0 -> null
    checkIn <= 2 -> 1
    checkIn == 3 -> 2
    else -> 3
}

/** Tasks with no energy set always fit. */
fun fitsEnergy(task: Task, capacity: Int?): Boolean = capacity == null || task.energy == null || task.energy <= capacity

/* ---------------------------- next actions ---------------------------- */

/** One thing to do: a task, or its first open step so it's small enough to start. */
data class NextAction(val item: Task, val parent: Task, val minutes: Int?, val estimate: String) {
    val isStep get() = item.id != parent.id
}

private val PRIORITY_WEIGHT = mapOf("critical" to 4, "high" to 3, "medium" to 2, "low" to 1)

private fun urgencyRank(task: Task, today: String) = when {
    task.dueDate != null && task.dueDate < today -> 0
    task.dueDate == today -> 1
    else -> 2
}

/** Steps of a task, in stored position order. */
fun stepsOf(task: Task, all: List<Task>): List<Task> =
    all.filter { it.parentTaskId == task.id }.sortedWith(compareBy({ it.position }, { it.createdAt ?: "" }))

/**
 * Open tasks in the order to do them: by urgency, then what fits today's
 * energy, then priority, then the shortest known estimate (unknown is
 * unknown, never zero), then the oldest.
 */
fun nextActions(tasks: List<Task>, today: LocalDate, capacity: Int? = null): List<NextAction> {
    val t = today.toString()
    return topLevel(tasks).filter { it.isOpen() && !notStartedYet(it, t) }.map { parent ->
        val item = stepsOf(parent, tasks).firstOrNull { it.isOpen() } ?: parent
        NextAction(item, parent, item.estimatedMinutes, estimateLabel(item))
    }.sortedWith(
        compareBy<NextAction> { urgencyRank(it.parent, t) }
            .thenBy { if (fitsEnergy(it.parent, capacity)) 0 else 1 }
            .thenByDescending { PRIORITY_WEIGHT[it.parent.priority] ?: 2 }
            .thenBy { it.minutes ?: Int.MAX_VALUE }
            .thenBy { it.parent.createdAt ?: "" },
    )
}

/** The single next thing (the head of [nextActions]), for widgets and the Today card. */
fun nextAction(tasks: List<Task>, today: LocalDate = LocalDate.now()): Task? = nextActions(tasks, today).firstOrNull()?.item

/* ------------------------------ stuck ------------------------------ */

/** How long a task has to be around before it can count as stuck. */
const val STUCK_AFTER_DAYS = 14

enum class StuckReason { Postponed, Overdue, Untouched }

data class StuckTask(val task: Task, val days: Long, val reason: StuckReason) {
    /** A plain description of why it's shown, from the task's own record. */
    val detail: String get() = when (reason) {
        StuckReason.Postponed -> "Moved ${task.postponedCount} times"
        StuckReason.Overdue -> "Past its date"
        StuckReason.Untouched -> "Not touched in a while"
    }
}

/**
 * Open top-level tasks at least two weeks old that haven't moved: no step done
 * in the last week, and either moved twice or more, a week past their date,
 * or untouched for two weeks. Oldest first. "Waiting" is already a decision.
 * (After How to ADHD's "Wall of Awful"; nothing is scored.)
 */
fun stuckTasks(tasks: List<Task>, today: LocalDate, zone: ZoneId = ZoneId.systemDefault()): List<StuckTask> {
    fun daysSince(timestamp: String?): Long? {
        val day = localDateOf(timestamp, zone) ?: timestamp?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return null
        return ChronoUnit.DAYS.between(day, today)
    }
    val recentStep = tasks.filter { it.parentTaskId != null && (daysSince(it.completedAt) ?: 99) <= 7 }.mapNotNull { it.parentTaskId }.toSet()
    return tasks.filter { it.parentTaskId == null && it.status in setOf("inbox", "todo", "in_progress") }.mapNotNull { task ->
        val age = daysSince(task.createdAt) ?: return@mapNotNull null
        if (age < STUCK_AFTER_DAYS || task.id in recentStep) return@mapNotNull null
        val pastDue = task.dueDate?.let { ChronoUnit.DAYS.between(LocalDate.parse(it.take(10)), today) }
        val untouched = daysSince(task.updatedAt) ?: age
        val reason = when {
            task.postponedCount >= 2 -> StuckReason.Postponed
            pastDue != null && pastDue >= 7 -> StuckReason.Overdue
            untouched >= STUCK_AFTER_DAYS -> StuckReason.Untouched
            else -> null
        } ?: return@mapNotNull null
        StuckTask(task, age, reason)
    }.sortedByDescending { it.days }
}
