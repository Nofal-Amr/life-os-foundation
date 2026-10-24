package app.lifeos.kt.data.logic

import app.lifeos.kt.core.common.instantOf
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.core.model.Goal
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Project
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Task
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.chrono.HijrahDate
import java.time.temporal.ChronoField
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// The web's Calendar (src/routes/_authenticated/calendar.tsx, data/calendarLayout.ts,
// data/holidays.ts): everything with a date, from real rows only.

enum class Source(val label: String) {
    Events("Events"), Tasks("Tasks"), Projects("Projects"), Goals("Goals"), Costs("Recurring costs"), Health("Health logs"), Holidays("Holidays"),
}

/** Where tapping an item goes; events open their own editor. */
sealed interface Target {
    data class Event(val event: CalendarEvent) : Target
    data class TaskT(val id: String) : Target
    data object ProjectsT : Target
    data object GoalsT : Target
    data object CostsT : Target
    data object HealthT : Target
    data object None : Target
}

data class CalItem(
    val id: String,
    val source: Source,
    val date: LocalDate,
    val title: String,
    val detail: String,
    /** Timed items sit on the Day/Week grid; the rest go in the all-day strip. */
    val start: LocalDateTime? = null,
    val end: LocalDateTime? = null,
    val projected: Boolean = false,
    val done: Boolean = false,
    val icon: String? = null,
    val color: String? = null,
    val target: Target = Target.None,
)

data class Holiday(val date: LocalDate, val name: String, val localName: String?, val kind: String)

fun calendarItems(
    events: List<CalendarEvent>,
    tasks: List<Task>,
    projects: List<Project>,
    goals: List<Goal>,
    costs: List<RecurringCost>,
    health: List<HealthLog>,
    holidays: List<Holiday>,
    money: (Double) -> String,
    zone: ZoneId = ZoneId.systemDefault(),
): List<CalItem> {
    val list = mutableListOf<CalItem>()
    for (event in events) {
        val start = instantOf(event.startAt)?.atZone(zone)?.toLocalDateTime() ?: continue
        val end = instantOf(event.endAt)?.atZone(zone)?.toLocalDateTime()
        // A midnight start with no end reads as an all-day event, as on the web.
        val allDay = start.toLocalTime() == LocalTime.MIDNIGHT && end == null
        list += CalItem("event-${event.id}", Source.Events, start.toLocalDate(), event.title, "Event", if (allDay) null else start, if (allDay) null else end, target = Target.Event(event))
    }
    for (task in tasks) {
        val due = task.dueDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: continue
        if (task.parentTaskId != null) continue
        val project = projects.firstOrNull { it.id == task.projectId }
        val open = task.isOpen()
        val at = task.dueTime?.let { runCatching { LocalTime.parse(it.take(8)) }.getOrNull() }?.let { due.atTime(it) }
        list += CalItem(
            "task-${task.id}", Source.Tasks, due, if (open) task.title else "✓ ${task.title}",
            listOfNotNull("Task", project?.name, "done".takeIf { !open }).joinToString(" · "),
            start = at, done = !open, icon = project?.icon, color = project?.color, target = Target.TaskT(task.id),
        )
    }
    for (project in projects) {
        val due = project.dueDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: continue
        list += CalItem("project-${project.id}", Source.Projects, due, project.name, "Project due", icon = project.icon, color = project.color, target = Target.ProjectsT)
    }
    for (goal in goals) {
        val due = goal.targetDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: continue
        list += CalItem("goal-${goal.id}", Source.Goals, due, goal.name, "Goal target", icon = goal.icon, color = goal.color, target = Target.GoalsT)
    }
    for (cost in costs) {
        if (!cost.active) continue
        val due = runCatching { LocalDate.parse(cost.nextDueDate.take(10)) }.getOrNull() ?: continue
        list += CalItem("cost-${cost.id}", Source.Costs, due, cost.name, "Recurring cost · projected · ${money(abs(cost.amount))}", projected = true, target = Target.CostsT)
    }
    for (log in health) {
        val day = runCatching { LocalDate.parse(log.logDate) }.getOrNull() ?: continue
        list += CalItem("health-${log.id}", Source.Health, day, "Health logged", "Health log", target = Target.HealthT)
    }
    for (holiday in holidays) {
        list += CalItem(
            "holiday-${holiday.date}-${holiday.name}", Source.Holidays, holiday.date, holiday.name,
            if (holiday.kind == "islamic") "${holiday.localName ?: "Islamic occasion"} · expected" else holiday.localName ?: "Public holiday",
        )
    }
    return list
}

/** The seven days of [day]'s week, starting on [weekStartsOn] (0 = Sunday, as the web stores it). */
fun weekDays(day: LocalDate, weekStartsOn: Int): List<LocalDate> {
    val dow = day.dayOfWeek.value % 7 // Sunday = 0
    val first = day.minusDays(((dow - weekStartsOn + 7) % 7).toLong())
    return (0L..6L).map { first.plusDays(it) }
}

/** Every day the month grid shows: whole weeks from the one holding the 1st to the one holding the last day. */
fun monthGrid(month: LocalDate, weekStartsOn: Int): List<LocalDate> {
    val first = weekDays(month.withDayOfMonth(1), weekStartsOn).first()
    val last = weekDays(month.withDayOfMonth(month.lengthOfMonth()), weekStartsOn).last()
    return generateSequence(first) { it.plusDays(1) }.takeWhile { !it.isAfter(last) }.toList()
}

/* ------------------------------ time grid ------------------------------ */

data class Block(val id: String, val top: Int, val height: Int, val column: Int, val columns: Int)

/** Items with no end, or very short ones, still get a block this tall (minutes). */
const val MIN_MINUTES = 30
private const val DAY_MINUTES = 24 * 60

/** Minutes from midnight for top and height, side by side where items overlap (the web's layoutTimed). */
fun layoutTimed(items: List<Triple<String, LocalDateTime, LocalDateTime?>>, day: LocalDate): List<Block> {
    val midnight = day.atStartOfDay()
    val spans = items.map { (id, start, end) ->
        val top = max(0, ChronoUnit.MINUTES.between(midnight, start).toInt())
        val endMinutes = end?.let { ChronoUnit.MINUTES.between(midnight, it).toInt() } ?: top
        val bottom = min(DAY_MINUTES, max(endMinutes, top + MIN_MINUTES))
        Triple(id, min(top, DAY_MINUTES - MIN_MINUTES), bottom)
    }.sortedWith(compareBy<Triple<String, Int, Int>> { it.second }.thenByDescending { it.third })

    val blocks = mutableListOf<Block>()
    var group = mutableListOf<Pair<Triple<String, Int, Int>, Int>>()
    var groupEnd = -1
    fun flush() {
        val columns = max(1, (group.maxOfOrNull { it.second } ?: 0) + 1)
        for ((span, column) in group) blocks += Block(span.first, span.second, span.third - span.second, column, columns)
        group = mutableListOf()
    }
    for (span in spans) {
        if (group.isNotEmpty() && span.second >= groupEnd) flush()
        var column = 0
        while (group.any { it.second == column && it.first.third > span.second }) column++
        group += span to column
        groupEnd = if (group.size == 1) span.third else max(groupEnd, span.third)
    }
    if (group.isNotEmpty()) flush()
    return blocks
}

/* ------------------------------- holidays ------------------------------- */

private val ISLAMIC = listOf(
    Triple(1, 1, "Islamic New Year" to "رأس السنة الهجرية"),
    Triple(1, 10, "Ashura" to "عاشوراء"),
    Triple(3, 12, "Mawlid an-Nabi" to "المولد النبوي"),
    Triple(9, 1, "Ramadan begins" to "أول رمضان"),
    Triple(10, 1, "Eid al-Fitr" to "عيد الفطر"),
    Triple(12, 9, "Day of Arafah" to "يوم عرفة"),
    Triple(12, 10, "Eid al-Adha" to "عيد الأضحى"),
)

/**
 * Islamic occasions in a Gregorian year, from the Umm al-Qura Hijri calendar
 * on the phone (offline). Lunar dates can move a day with the moon sighting,
 * so they're shown as expected.
 */
fun islamicDays(year: Int): List<Holiday> {
    val out = mutableListOf<Holiday>()
    var date = LocalDate.of(year, 1, 1)
    while (date.year == year) {
        val hijri = runCatching { HijrahDate.from(date) }.getOrNull()
        if (hijri != null) {
            val month = hijri.get(ChronoField.MONTH_OF_YEAR)
            val day = hijri.get(ChronoField.DAY_OF_MONTH)
            ISLAMIC.firstOrNull { it.first == month && it.second == day }?.let { (_, _, names) -> out += Holiday(date, names.first, names.second, "islamic") }
        }
        date = date.plusDays(1)
    }
    return out
}
