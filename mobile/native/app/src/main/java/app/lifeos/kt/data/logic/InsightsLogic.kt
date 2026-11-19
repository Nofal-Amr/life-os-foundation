package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.HealthSample
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.round
import kotlin.math.sqrt

/*
 * History and insights from what was logged, ported from the website
 * (src/data/insights.ts): counts, never scores. Month by month; which daily
 * figures went together (with how many days, never "causes"); habits by weekday.
 */

data class Sources(
    val tasks: List<Task>,
    val prayerLogs: List<PrayerLog>,
    val transactions: List<Transaction>,
    val habitLogs: List<HabitLog>,
    val habits: List<Habit>,
    val samples: List<HealthSample>,
)

data class MonthRow(val month: YearMonth, val tasksDone: Int, val prayed: Int, val spent: Double, val habitCheckIns: Int)

private fun localDate(stamp: String?, zone: ZoneId): LocalDate? = stamp?.let {
    runCatching { OffsetDateTime.parse(it).atZoneSameInstant(zone).toLocalDate() }.getOrNull()
        ?: runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull()
        ?: runCatching { LocalDate.parse(it.take(10)) }.getOrNull()
}

private fun prayedStatus(log: PrayerLog) = prayerStatus(log).let { it != null && it != "missed" }

/** The last [months] months, oldest first, with what was done in each. */
fun byMonth(sources: Sources, today: LocalDate, months: Int = 6, zone: ZoneId = ZoneId.systemDefault()): List<MonthRow> {
    val keys = (months - 1 downTo 0).map { YearMonth.from(today).minusMonths(it.toLong()) }
    return keys.map { month ->
        fun inMonth(date: LocalDate?) = date != null && YearMonth.from(date) == month
        MonthRow(
            month = month,
            tasksDone = sources.tasks.count { it.status == "completed" && inMonth(localDate(it.completedAt, zone)) },
            prayed = sources.prayerLogs.count { prayedStatus(it) && it.prayerDate.startsWith(month.toString()) },
            spent = sources.transactions.filter { it.kind == "expense" && it.date.startsWith(month.toString()) }.sumOf { abs(it.amount) },
            habitCheckIns = sources.habitLogs.count { it.logDate.startsWith(month.toString()) },
        )
    }
}

data class Series(val key: String, val label: String, val values: List<Double?>)

/** The day a health reading belongs to: sleep counts for the morning it ends. */
private fun sampleDay(sample: HealthSample, zone: ZoneId): LocalDate? {
    val night = sample.kind == "sleep" || sample.kind == "sleep_score"
    return localDate(if (night && sample.endAt != null) sample.endAt else sample.startAt, zone)
}

/** One value a day per kind: totals for steps and sleep, the average for heart rate and sleep score, the latest weight. */
fun dailyValues(samples: List<HealthSample>, kind: String, dates: List<LocalDate>, zone: ZoneId = ZoneId.systemDefault()): List<Double?> {
    val byDay = samples.filter { it.kind == kind }.groupBy { sampleDay(it, zone) }
    return dates.map { day ->
        val list = byDay[day].orEmpty()
        when {
            list.isEmpty() -> null
            kind == "heart_rate" || kind == "sleep_score" -> list.sumOf { it.value } / list.size
            kind == "weight" -> list.maxBy { it.startAt }.value
            else -> list.sumOf { it.value }
        }
    }
}

/** Daily figures for the last [days] days; null where nothing was logged. */
fun dailySeries(sources: Sources, today: LocalDate, days: Int = 90, zone: ZoneId = ZoneId.systemDefault()): List<Series> {
    val dates = daysEnding(today, days)
    val index = dates.withIndex().associate { it.value to it.index }
    fun blank() = MutableList<Double?>(dates.size) { null }
    // Not "add": MutableList.add(index, element) would win and insert instead.
    fun MutableList<Double?>.bump(i: Int, v: Double) { this[i] = (this[i] ?: 0.0) + v }

    val tasks = blank()
    sources.tasks.filter { it.status == "completed" }.forEach { t -> index[localDate(t.completedAt, zone)]?.let { tasks.bump(it, 1.0) } }
    val prayed = blank()
    val prayerLogged = mutableSetOf<Int>()
    sources.prayerLogs.forEach { log ->
        val i = index[runCatching { LocalDate.parse(log.prayerDate) }.getOrNull()] ?: return@forEach
        prayerLogged += i
        prayed.bump(i, if (prayedStatus(log)) 1.0 else 0.0)
    }
    val spent = blank()
    sources.transactions.filter { it.kind == "expense" }.forEach { t -> index[runCatching { LocalDate.parse(t.date) }.getOrNull()]?.let { spent.bump(it, abs(t.amount)) } }
    val habits = blank()
    sources.habitLogs.forEach { log -> index[runCatching { LocalDate.parse(log.logDate) }.getOrNull()]?.let { habits.bump(it, 1.0) } }
    val sleep = dailyValues(sources.samples, "sleep", dates, zone).map { v -> v?.takeIf { it != 0.0 }?.let { it / 60 } }
    val steps = dailyValues(sources.samples, "steps", dates, zone).map { v -> v?.takeIf { it != 0.0 } }

    // A day counts as 0 (not unknown) only if something else was logged that day.
    val used = dates.indices.map { i -> listOf(prayed[i], spent[i], habits[i], sleep[i], steps[i]).any { it != null } || tasks[i] != null }
    fun zeroIfUsed(values: List<Double?>) = values.mapIndexed { i, v -> if (v == null && used[i]) 0.0 else v }

    return listOf(
        Series("sleep", "hours of sleep", sleep),
        Series("steps", "steps", steps),
        Series("tasks", "tasks done", zeroIfUsed(tasks)),
        Series("prayed", "prayers prayed", prayed.mapIndexed { i, v -> if (i in prayerLogged) v else null }),
        Series("spent", "spent", zeroIfUsed(spent)),
        Series("habits", "habit check-ins", zeroIfUsed(habits)),
    )
}

/** Pearson correlation over days both have a value; null below [minDays] or with no spread. */
fun correlation(a: List<Double?>, b: List<Double?>, minDays: Int = 14): Pair<Double, Int>? {
    val pairs = a.indices.mapNotNull { i -> val x = a[i]; val y = b.getOrNull(i); if (x != null && y != null) x to y else null }
    if (pairs.size < minDays) return null
    val n = pairs.size
    val mx = pairs.sumOf { it.first } / n
    val my = pairs.sumOf { it.second } / n
    var sxy = 0.0; var sxx = 0.0; var syy = 0.0
    for ((x, y) in pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); syy += (y - my) * (y - my) }
    if (sxx == 0.0 || syy == 0.0) return null
    return sxy / sqrt(sxx * syy) to n
}

data class Pairing(val a: Series, val b: Series, val r: Double, val days: Int, val strength: String)

/** Pairs that went together at least weakly (|r| ≥ 0.3), strongest first. */
fun pairings(series: List<Series>, minDays: Int = 14): List<Pairing> {
    val out = mutableListOf<Pairing>()
    for (i in series.indices) for (j in i + 1 until series.size) {
        val (r, days) = correlation(series[i].values, series[j].values, minDays) ?: continue
        if (abs(r) < 0.3) continue
        val size = abs(r)
        out += Pairing(series[i], series[j], round(r * 100) / 100, days, if (size >= 0.6) "strong" else if (size >= 0.45) "moderate" else "weak")
    }
    return out.sortedByDescending { abs(it.r) }
}

/** The sentence for a pairing: a pattern in your days, never a cause. */
fun pairingLine(p: Pairing): String =
    if (p.r > 0) "On days with more ${p.a.label}, ${p.b.label} tended to be higher too."
    else "On days with more ${p.a.label}, ${p.b.label} tended to be lower."

data class WeekdayPattern(val weekday: Int, val done: Int, val of: Int)

/**
 * For each weekday (0 = Sunday … 6 = Saturday): how many of the last [weeks]
 * such days the habit was logged. Days before the habit existed don't count.
 */
fun habitByWeekday(habitId: String, createdOn: LocalDate?, logs: List<HabitLog>, today: LocalDate, weeks: Int = 8): List<WeekdayPattern> {
    val logged = logs.filter { it.habitId == habitId }.map { it.logDate }.toSet()
    val done = IntArray(7)
    val of = IntArray(7)
    for (date in daysEnding(today, weeks * 7)) {
        if (createdOn != null && date < createdOn) continue
        val w = date.dayOfWeek.value % 7
        of[w]++
        if (date.toString() in logged) done[w]++
    }
    return (0..6).map { WeekdayPattern(it, done[it], of[it]) }
}
