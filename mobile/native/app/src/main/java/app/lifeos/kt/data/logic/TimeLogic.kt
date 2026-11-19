package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.TimeEntry
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.roundToInt

/** Time, ported from the website (src/data/time.ts). */

/** Suggestions for a first set of activities: name, icon, colour. Each can be renamed or archived. */
val STARTER_ACTIVITIES = listOf(
    Triple("Gaming", "gamepad-2", "violet"),
    Triple("Reading", "book-open", "amber"),
    Triple("Learning", "graduation-cap", "blue"),
    Triple("Social", "users", "rose"),
    Triple("Hobby", "palette", "teal"),
    Triple("Exercise", "dumbbell", "green"),
)

private fun instant(stamp: String): Instant? = runCatching { Instant.parse(stamp) }.getOrNull()
    ?: runCatching { java.time.OffsetDateTime.parse(stamp).toInstant() }.getOrNull()

/** Whole minutes in an entry; a running one counts up to [now]. */
fun entryMinutes(entry: TimeEntry, now: Long = System.currentTimeMillis()): Int {
    val start = instant(entry.startedAt)?.toEpochMilli() ?: return 0
    val end = entry.endedAt?.let(::instant)?.toEpochMilli() ?: now
    return maxOf(0, ((end - start) / 60_000.0).roundToInt())
}

/** "45 min", "2 h", "1 h 20". */
fun formatMinutes(minutes: Int): String {
    val h = minutes / 60
    val m = minutes % 60
    return when {
        h == 0 -> "$m min"
        m == 0 -> "$h h"
        else -> "$h h $m"
    }
}

/** "01:02:03" for a running clock. */
fun formatClock(ms: Long): String {
    val total = maxOf(0L, ms / 1000)
    return "%02d:%02d:%02d".format(total / 3600, (total % 3600) / 60, total % 60)
}

/** The local day an entry started. */
fun entryDay(entry: TimeEntry, zone: ZoneId = ZoneId.systemDefault()): LocalDate? = instant(entry.startedAt)?.atZone(zone)?.toLocalDate()

/** The key an entry is grouped under: its activity, its task, or its label. */
fun entryKey(entry: TimeEntry): String = when {
    entry.activityId != null -> "a:${entry.activityId}"
    entry.taskId != null -> "t:${entry.taskId}"
    else -> "l:${entry.label.orEmpty()}"
}

/** Minutes per day for [days], by the day each entry started. */
fun minutesByDay(entries: List<TimeEntry>, days: List<LocalDate>, now: Long = System.currentTimeMillis(), zone: ZoneId = ZoneId.systemDefault()): List<Int> {
    val totals = IntArray(days.size)
    val index = days.withIndex().associate { it.value to it.index }
    for (entry in entries) index[entryDay(entry, zone)]?.let { totals[it] += entryMinutes(entry, now) }
    return totals.toList()
}

/** Minutes per key (activity, task or label) for entries started on [days], largest first. */
fun minutesByKey(entries: List<TimeEntry>, days: List<LocalDate>, now: Long = System.currentTimeMillis(), zone: ZoneId = ZoneId.systemDefault()): List<Pair<String, Int>> {
    val inRange = days.toSet()
    return entries.filter { entryDay(it, zone) in inRange }
        .groupBy(::entryKey)
        .map { (key, list) -> key to list.sumOf { entryMinutes(it, now) } }
        .filter { it.second > 0 }
        .sortedByDescending { it.second }
}

/** The [count] days ending on [today], oldest first. */
fun daysEnding(today: LocalDate, count: Int): List<LocalDate> = (count - 1 downTo 0).map { today.minusDays(it.toLong()) }
