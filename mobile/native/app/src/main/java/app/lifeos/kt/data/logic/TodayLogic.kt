package app.lifeos.kt.data.logic

import app.lifeos.kt.core.common.localDateOf
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.FoodLog
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.core.model.MedicationLog
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.roundToInt

// Ported from src/data/todayRing.ts, hub.ts, daySummary.ts and the dashboard.
// Every figure is a count of stored rows; nothing is scored or judged.

fun greeting(now: LocalTime = LocalTime.now()) = when {
    now.hour < 12 -> "Good morning"
    now.hour < 18 -> "Good afternoon"
    else -> "Good evening"
}

/* -------------------------------- ring -------------------------------- */

/** One area's real "done of planned today"; the ring has no combined score. */
data class RingSegment(val key: String, val label: String, val done: Int, val total: Int)

fun todayRing(
    today: LocalDate,
    tasks: List<Task>?,
    habits: List<Habit>?,
    habitLogs: List<HabitLog>,
    prayersLogged: Int?,
    doses: Pair<Int, Int>?,
    zone: ZoneId = ZoneId.systemDefault(),
): List<RingSegment> {
    val t = today.toString()
    val segments = mutableListOf<RingSegment>()
    if (tasks != null) {
        fun doneToday(task: Task) = task.status == "completed" && localDateOf(task.completedAt, zone) == today
        val planned = tasks.filter { task ->
            when {
                task.parentTaskId != null -> false
                doneToday(task) -> true
                task.status == "completed" || task.status == "cancelled" -> false
                else -> task.dueDate != null && task.dueDate <= t
            }
        }
        segments += RingSegment("tasks", "Tasks", planned.count(::doneToday), planned.size)
    }
    if (habits != null) {
        val daily = habits.filter { it.active && it.frequency == "daily" }
        val logged = habitLogs.filter { it.logDate == t }.map { it.habitId }.toSet()
        segments += RingSegment("habits", "Habits", daily.count { it.id in logged }, daily.size)
    }
    if (prayersLogged != null) segments += RingSegment("prayers", "Prayers", minOf(5, prayersLogged), 5)
    if (doses != null) segments += RingSegment("medication", "Medication", minOf(doses.first, doses.second), doses.second)
    // An area with nothing planned today has nothing to show.
    return segments.filter { it.total > 0 }
}

/* ----------------------------- medication ----------------------------- */

data class Dose(val medication: Medication, val slot: String, val taken: Boolean)

/** Today's scheduled doses in time order, each with whether it's been logged as taken. */
fun dosesFor(today: LocalDate, medications: List<Medication>, logs: List<MedicationLog>): List<Dose> {
    val t = today.toString()
    val taken = logs.filter { it.logDate == t && it.taken }.map { "${it.medicationId}-${it.timeSlot}" }.toSet()
    return medications.filter { it.active }
        .flatMap { med -> med.scheduleTimes.orEmpty().map { slot -> Dose(med, slot, "${med.id}-$slot" in taken) } }
        .sortedBy { it.slot }
}

/* ---------------------------- last 7 days ---------------------------- */

/** One line per life area for the last 7 days, as the web's Serious skin shows it. */
data class HubLine(val key: String, val label: String, val count: String)

fun hubLines(
    today: LocalDate,
    tasks: List<Task>,
    prayerLogs: List<PrayerLog>,
    medications: List<Medication>,
    medicationLogs: List<MedicationLog>,
    habits: List<Habit>,
    habitLogs: List<HabitLog>,
    transactions: List<Transaction>,
): List<HubLine> {
    val from = today.minusDays(6).toString()
    val t = today.toString()
    fun inWeek(date: String?) = date != null && date.take(10) >= from && date.take(10) <= t
    val lines = mutableListOf<HubLine>()

    val slots = medications.filter { it.active }.sumOf { it.scheduleTimes.orEmpty().toSet().size }
    val taken = medicationLogs.count { it.taken && inWeek(it.logDate) }
    lines += HubLine("body", "Body", if (slots > 0) "$taken of ${slots * 7} doses" else "Nothing logged")

    val logged = transactions.count { inWeek(it.date) }
    lines += HubLine("money", "Money", "$logged ${if (logged == 1) "entry" else "entries"} logged")

    val due = tasks.filter { it.parentTaskId == null && it.status != "cancelled" && inWeek(it.dueDate) }
    lines += HubLine("work", "Work", if (due.isNotEmpty()) "${due.count { it.status == "completed" }} of ${due.size} tasks done" else "No tasks were due")

    val prayed = prayerLogs.count { it.prayerName in FIVE && inWeek(it.prayerDate) && prayerStatus(it).let { s -> s != null && s != "missed" } }
    lines += HubLine("spirit", "Spirit", "$prayed of 35 prayers")

    val daily = habits.filter { it.active && it.frequency == "daily" }
    val checkIns = habitLogs.count { log -> inWeek(log.logDate) && daily.any { it.id == log.habitId } }
    lines += HubLine("habits", "Habits", if (daily.isNotEmpty()) "$checkIns of ${daily.size * 7} check-ins" else "No daily habits")
    return lines
}

val FIVE = setOf("fajr", "dhuhr", "asr", "maghrib", "isha")

/** Prayers of the five logged today as prayed (not "missed"). */
fun prayedToday(logs: List<PrayerLog>, today: LocalDate): Int =
    logs.count { it.prayerDate == today.toString() && it.prayerName in FIVE && prayerStatus(it).let { s -> s != null && s != "missed" } }

/* --------------------------- today so far --------------------------- */

/** "A, B and 2 more": names in the order logged, without repeats. */
fun listNames(names: List<String>, max: Int = 3): String {
    val unique = names.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    return if (unique.size <= max) unique.joinToString(", ") else unique.take(max).joinToString(", ") + " and ${unique.size - max} more"
}

data class DayLine(val text: String, val detail: String? = null)

/** A receipt of the day: one line per kind of thing actually logged. */
fun dayLines(
    today: LocalDate,
    tasks: List<Task>,
    transactions: List<Transaction>,
    categories: List<FinanceCategory>,
    foodLogs: List<FoodLog>,
    medications: List<Medication>,
    medicationLogs: List<MedicationLog>,
    health: HealthLog?,
    prayersLogged: Int,
    habitsTicked: Int,
    money: (Double) -> String,
    zone: ZoneId = ZoneId.systemDefault(),
): List<DayLine> {
    val t = today.toString()
    val lines = mutableListOf<DayLine>()
    val done = tasks.count { it.status == "completed" && localDateOf(it.completedAt, zone) == today }
    if (done > 0) lines += DayLine("$done ${if (done == 1) "task" else "tasks"} completed")

    val names = categories.associate { it.id to it.name }
    val todays = transactions.filter { it.date == t }
    val spending = todays.filter { it.kind == "expense" }
    if (spending.isNotEmpty()) {
        lines += DayLine("${money(spending.sumOf { abs(it.amount) })} spent", listNames(spending.map { it.description?.trim()?.ifEmpty { null } ?: it.categoryId?.let(names::get) ?: "Spending" }))
    }
    val income = todays.filter { it.kind == "income" }.sumOf { abs(it.amount) }
    if (income > 0) lines += DayLine("${money(income)} received")

    val meals = foodLogs.filter { it.logDate == t }
    if (meals.isNotEmpty()) lines += DayLine("${"%,d".format(meals.sumOf { it.calories }.roundToInt())} kcal logged", "${meals.size} ${if (meals.size == 1) "entry" else "entries"}")

    val medName = medications.associate { it.id to it.name }
    val taken = medicationLogs.filter { it.logDate == t && it.taken }
    if (taken.isNotEmpty()) lines += DayLine("${taken.size} ${if (taken.size == 1) "dose" else "doses"} taken", listNames(taken.map { medName[it.medicationId] ?: "Medication" }))

    health?.sleepHours?.takeIf { it > 0 }?.let { hours ->
        val minutes = (hours * 60).roundToInt()
        lines += DayLine(if (minutes % 60 == 0) "${minutes / 60}h sleep" else "${minutes / 60}h ${minutes % 60}m sleep")
    }
    if (prayersLogged > 0) lines += DayLine("$prayersLogged of 5 prayers logged")
    if (habitsTicked > 0) lines += DayLine("$habitsTicked ${if (habitsTicked == 1) "habit" else "habits"} ticked")
    return lines
}

/* ----------------------------- coming up ----------------------------- */

/** "You do ·" (something you'll do) or "Happens ·" (something that will happen). */
data class ComingUp(val sort: String, val title: String, val detail: String, val commitment: Boolean, val dimension: String)

/** The web's default life-area order (Settings can change it). */
val DEFAULT_DIMENSION_ORDER = listOf("health", "spirit", "professional", "discipline", "knowledge")

fun comingUp(
    today: LocalDate,
    tasks: List<Task>,
    projects: List<Project>,
    goals: List<Goal>,
    costs: List<RecurringCost>,
    payday: LocalDate?,
    reminders: List<Reminder>,
    money: (Double) -> String,
    date: (String) -> String,
    dimensionOrder: List<String> = DEFAULT_DIMENSION_ORDER,
): List<ComingUp> {
    val t = today.toString()
    val nextWeek = today.plusDays(7).toString()
    val items = mutableListOf<ComingUp>()
    for (task in topLevel(tasks).filter { it.isOpen() }) {
        val notStarted = notStartedYet(task, t)
        val marker = (if (notStarted) task.startDate else task.dueDate)?.take(10) ?: continue
        if (marker > nextWeek) continue
        items += ComingUp(
            marker,
            task.title,
            when {
                notStarted -> "Task · Starts ${date(marker)}"
                task.dueDate == t -> "Task · Due today"
                else -> "Task · Due ${date(marker)}"
            },
            true,
            "discipline",
        )
    }
    for (project in projects) {
        val due = project.dueDate?.take(10) ?: continue
        if (project.status in setOf("archived", "completed") || due > nextWeek) continue
        items += ComingUp(due, project.name, "Project · Due ${date(due)}", true, "professional")
    }
    for (goal in goals) {
        val target = goal.targetDate?.take(10) ?: continue
        if (goal.status == "completed" || target > nextWeek) continue
        items += ComingUp(target, goal.name, "Goal · Target ${date(target)}", true, "knowledge")
    }
    if (payday != null) {
        for (cost in costs.filter { it.active && it.nextDueDate.take(10) <= payday.toString() }) {
            items += ComingUp(cost.nextDueDate, cost.name, "Recurring cost · ${money(cost.amount)} · ${date(cost.nextDueDate)}", false, "professional")
        }
    }
    for (reminder in reminders.filter { it.doneAt == null }) {
        val day = localDateOf(reminder.remindAt) ?: continue
        if (day.isBefore(today) || day.toString() > nextWeek) continue
        items += ComingUp(day.toString(), reminder.title, "Reminder · ${date(day.toString())}", true, "discipline")
    }
    val rank = dimensionOrder.withIndex().associate { (i, d) -> d to i }
    return items.sortedWith(compareBy<ComingUp> { rank[it.dimension] ?: 99 }.thenBy { it.sort })
}
