package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.DailyReview
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.abs

/*
 * The daily review, ported from the website: Reflect (src/data/reflections.ts),
 * Close the day (src/data/closeDay.ts) and the week recap (src/data/week.ts).
 */

/** One reflection at a time: three go into the day's review, ideas and notes go to Notes. */
enum class ReflectionKind(val label: String, val short: String, val placeholder: String) {
    Good("Good thing", "Good", "Something that went well"),
    Hard("Hard thing", "Hard", "Something that was hard"),
    Grateful("Grateful for", "Grateful", "Something you're grateful for"),
    Idea("Idea", "Idea", "An idea worth keeping"),
    Note("Note", "Note", "Anything to remember"),
}

/** The tag that marks a note as an idea or a note from a reflection (as on the web). */
fun reflectionTag(kind: ReflectionKind) = if (kind == ReflectionKind.Idea) "idea" else "reflection"

/** Adds one line to a field, keeping what's there. */
fun appendLine(existing: String?, line: String): String {
    val text = line.trim()
    val before = existing.orEmpty().trimEnd()
    return if (before.isEmpty()) text else "$before\n$text"
}

/** The lines of a review field, one reflection each. */
fun linesOf(value: String?): List<String> = value.orEmpty().split("\n").map { it.trim() }.filter { it.isNotEmpty() }

/** The review with one more line in the field for [kind] (good, hard, grateful only). */
fun withReflection(review: DailyReview, kind: ReflectionKind, line: String): DailyReview = when (kind) {
    ReflectionKind.Good -> review.copy(wins = appendLine(review.wins, line))
    ReflectionKind.Hard -> review.copy(challenges = appendLine(review.challenges, line))
    ReflectionKind.Grateful -> review.copy(gratitude = appendLine(review.gratitude, line))
    else -> review
}

private fun localDay(stamp: String?, zone: ZoneId): String? =
    stamp?.let { runCatching { OffsetDateTime.parse(it).atZoneSameInstant(zone).toLocalDate().toString() }.getOrNull() ?: it.take(10) }

/** Ideas and notes captured as reflections on a day, in the order they came. */
fun reflectionNotesOn(notes: List<Note>, date: String, zone: ZoneId = ZoneId.systemDefault()): List<Note> =
    notes.filter { note -> note.tags.any { it == "idea" || it == "reflection" } && localDay(note.createdAt, zone) == date }
        .sortedBy { it.createdAt.orEmpty() }

/** One labelled line of the day: "Good · Finished the report". */
data class ReflectionLine(val label: String, val text: String)

fun dayReflections(review: DailyReview?, notes: List<Note>, date: String, zone: ZoneId = ZoneId.systemDefault()): List<ReflectionLine> =
    linesOf(review?.wins).map { ReflectionLine("Good", it) } +
        linesOf(review?.challenges).map { ReflectionLine("Hard", it) } +
        linesOf(review?.gratitude).map { ReflectionLine("Grateful", it) } +
        reflectionNotesOn(notes, date, zone).map { ReflectionLine(if ("idea" in it.tags) "Idea" else "Note", it.body ?: it.title) }

/** From this hour on, the day can be closed. */
const val EVENING_HOUR = 18

/** Open, top-level tasks dated on or before [date], oldest first: what closing the day moves to tomorrow. */
fun carryOver(tasks: List<Task>, date: String): List<Task> = tasks
    .filter { it.status != "completed" && it.status != "cancelled" && it.parentTaskId == null && it.dueDate != null && it.dueDate.take(10) <= date }
    .sortedWith(compareBy<Task>({ it.dueDate }, { it.dueTime ?: "99" }))

/** Done and total, for the week's counts. */
data class Fraction(val done: Int, val total: Int)

data class WeekCounts(val start: LocalDate, val tasks: Fraction, val busiest: Pair<LocalDate, Int>?, val habits: Fraction, val prayers: Fraction, val spent: Double, val spendDays: Int)

/** The first day of the week holding [day], with the web's numbering (0 = Sunday … 6 = Saturday). */
fun weekStartOf(day: LocalDate, weekStartsOn: Int): LocalDate {
    val dow = day.dayOfWeek.value % 7
    val back = ((dow - weekStartsOn) % 7 + 7) % 7
    return day.minusDays(back.toLong())
}

/**
 * The week's counts from what was logged (the web's buildWeek, without the
 * per-day lists). Habits and prayers only count days that have started.
 */
fun weekCounts(
    start: LocalDate,
    today: LocalDate,
    tasks: List<Task>,
    habits: List<Habit>,
    habitLogs: List<HabitLog>,
    prayerLogs: List<PrayerLog>,
    transactions: List<Transaction>,
    trackPrayers: Boolean,
    zone: ZoneId = ZoneId.systemDefault(),
): WeekCounts {
    val dates = (0L..6L).map { start.plusDays(it) }
    val end = dates.last().toString()
    val t = today.toString()
    // Dated parts replace their parent task, as on the web.
    val parentsWithParts = tasks.filter { it.parentTaskId != null && it.dueDate != null }.mapNotNull { it.parentTaskId }.toSet()
    val shown = tasks.filter { if (it.parentTaskId != null) it.dueDate != null else it.id !in parentsWithParts }
    fun place(task: Task): String? = when {
        task.status == "cancelled" -> null
        task.status == "completed" -> localDay(task.completedAt, zone) ?: task.dueDate?.take(10)
        task.dueDate == null -> null
        else -> maxOf(task.dueDate.take(10), t)
    }
    val placed = shown.mapNotNull { task -> place(task)?.takeIf { it >= start.toString() && it <= end }?.let { it to task } }
    val done = placed.count { it.second.status == "completed" }
    val busiest = placed.filter { it.second.status == "completed" }.groupingBy { it.first }.eachCount().maxByOrNull { it.value }?.let { LocalDate.parse(it.key) to it.value }
    val started = dates.filter { it <= today }.map { it.toString() }
    val daily = habits.filter { it.active && it.frequency == "daily" }.map { it.id }.toSet()
    val habitDone = started.sumOf { d -> habitLogs.filter { it.logDate == d && it.habitId in daily }.map { it.habitId }.toSet().size }
    val prayed = if (!trackPrayers) 0 else started.sumOf { d -> prayerLogs.filter { it.prayerDate == d && prayerStatus(it).let { s -> s != null && s != "missed" } }.map { it.prayerName }.filter { it in PRAYERS.map { p -> p.first } }.toSet().size }
    val spending = transactions.filter { it.kind == "expense" && it.date >= start.toString() && it.date <= end }
    return WeekCounts(
        start = start,
        tasks = Fraction(done, placed.size),
        busiest = busiest,
        habits = Fraction(habitDone, daily.size * started.size),
        prayers = Fraction(prayed, if (trackPrayers) 5 * started.size else 0),
        spent = spending.sumOf { abs(it.amount) },
        spendDays = spending.map { it.date }.toSet().size,
    )
}

/** The week in plain words, from the counts; nothing inferred or judged (the web's weekRecap). */
fun weekRecap(week: WeekCounts, money: (Double) -> String): List<String> {
    val lines = mutableListOf<String>()
    if (week.tasks.total > 0) lines += "${week.tasks.done} of ${week.tasks.total} tasks this week are done."
    week.busiest?.takeIf { it.second > 1 }?.let { (day, n) -> lines += "Most tasks finished on ${day.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())} ($n)." }
    if (week.habits.total > 0) lines += "${week.habits.done} of ${week.habits.total} daily habit check-ins logged so far."
    if (week.prayers.total > 0) lines += "${week.prayers.done} of ${week.prayers.total} prayers logged so far."
    if (week.spent > 0) lines += "${money(week.spent)} spent across ${week.spendDays} ${if (week.spendDays == 1) "day" else "days"}."
    return lines
}

