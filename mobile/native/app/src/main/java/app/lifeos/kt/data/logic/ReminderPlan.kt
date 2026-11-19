package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.DhikrLog
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.serialization.Serializable

/**
 * Phone reminders, ported from the website (src/data/reminders.ts,
 * src/data/userReminders.ts and PrayerReminders.tsx). Settings are per phone,
 * as on the web: reminders ring on the phone they're set on.
 */
@Serializable
data class ReminderSettings(
    /** A reminder before each prayer not yet logged. */
    val enabled: Boolean = true,
    val leadMinutes: Int = 10,
    /** A second one at the prayer time itself, with log buttons. */
    val atTime: Boolean = true,
    /** If a prayer still isn't logged 5 minutes before its time ends, one last nudge. */
    val clutch: Boolean = true,
    /** A daily list of tasks due, at [taskTime], and tasks with a time at that time. */
    val tasksEnabled: Boolean = true,
    val taskTime: String = "09:00",
    /** Morning azkar after Fajr, evening azkar after Asr, until read. */
    val azkar: Boolean = true,
    val azkarDelay: Int = 20,
    /** "A glass of water" every [waterEvery] minutes between [waterFrom] and [waterTo]. */
    val water: Boolean = false,
    val waterEvery: Int = 90,
    val waterFrom: String = "09:00",
    val waterTo: String = "22:00",
)

/** Which notification channel a reminder uses. */
enum class Channel { Prayers, Tasks }

/** One notification to ring at [at] (epoch millis). [prayer]: log buttons on it. [open]: the part of the app a tap opens. */
data class Planned(
    val id: String,
    val at: Long,
    val title: String,
    val body: String,
    val channel: Channel,
    val open: String,
    val prayer: PrayerAction? = null,
    /** Notifications with the same group replace one another (a prayer's early, on-time and clutch nudges). */
    val group: String = id,
)

data class PrayerAction(val date: String, val name: String, val actions: List<String>)

private const val MINUTE = 60_000L
private const val DAY = 86_400_000L

private fun clock(at: Long, zone: ZoneId, twentyFour: Boolean): String =
    DateTimeFormatter.ofPattern(if (twentyFour) "HH:mm" else "h:mm a", Locale.getDefault()).format(Instant.ofEpochMilli(at).atZone(zone))

private fun hhmm(value: String): LocalTime = runCatching { LocalTime.parse(value.take(5)) }.getOrDefault(LocalTime.of(9, 0))

/** Prayer reminders for the next [days] days: early, at the time, clutch, and azkar. */
fun prayerReminders(
    settings: ReminderSettings,
    place: PrayerSettings?,
    logs: List<PrayerLog>,
    dhikr: List<DhikrLog>,
    today: LocalDate,
    now: Long,
    zone: ZoneId = ZoneId.systemDefault(),
    twentyFour: Boolean = true,
    days: Int = 7,
): List<Planned> {
    if (!settings.enabled && !settings.azkar) return emptyList()
    val out = mutableListOf<Planned>()
    for (offset in 0 until days) {
        val day = today.plusDays(offset.toLong())
        val date = day.toString()
        val times = prayerTimes(place, day, zone) ?: return out
        val windows = prayerWindows(place, day, zone) ?: return out
        val at = times.associate { it.key to it.at.time }
        val ends = mapOf(
            "fajr" to windows.sunrise.time,
            "dhuhr" to at.getValue("asr"),
            "asr" to at.getValue("maghrib"),
            "maghrib" to at.getValue("isha"),
            "isha" to windows.nextFajr.time,
        )
        for (slot in times) {
            val name = slot.key
            val time = slot.at.time
            val label = prayerLabel(name, day)
            val logged = logs.any { it.prayerDate == date && it.prayerName == name && prayerStatus(it) != null }
            if (settings.enabled && !logged) {
                val early = time - settings.leadMinutes * MINUTE
                if (settings.leadMinutes > 0 && early > now) {
                    out += Planned("$date-$name", early, "$label in ${settings.leadMinutes} minutes", "$label at ${clock(time, zone, twentyFour)}.", Channel.Prayers, "spirit", group = "$date-$name")
                }
                if ((settings.atTime || settings.leadMinutes == 0) && time > now) {
                    out += Planned(
                        "$date-$name-now", time, "It's time for $label", "$label · ${clock(time, zone, twentyFour)}. Log it right here.",
                        Channel.Prayers, "spirit", PrayerAction(date, name, listOf("jamaah", "on_time")), group = "$date-$name",
                    )
                }
                val clutch = ends.getValue(name) - 5 * MINUTE
                if (settings.clutch && clutch > now && clutch > time) {
                    out += Planned(
                        "$date-$name-clutch", clutch, "$label isn't logged yet",
                        if (name == "fajr") "Sunrise is in 5 minutes." else "$label's time ends in 5 minutes.",
                        Channel.Prayers, "spirit", PrayerAction(date, name, listOf("clutch", "late")), group = "$date-$name",
                    )
                }
            }
            val azkarTime = when (name) { "fajr" -> "morning"; "asr" -> "evening"; else -> null }
            if (settings.azkar && azkarTime != null && !azkarDone(dhikr, date, azkarTime)) {
                val ring = time + settings.azkarDelay * MINUTE
                if (ring > now) {
                    out += Planned(
                        "$date-azkar-$azkarTime", ring,
                        if (azkarTime == "morning") "Morning azkar · أذكار الصباح" else "Evening azkar · أذكار المساء",
                        "Tap to read them, or log them here if you already have.",
                        Channel.Prayers, "azkar", PrayerAction(date, "azkar_$azkarTime", listOf("read")),
                    )
                }
            }
        }
    }
    return out
}

/** Open, top-level tasks due on [date] (today also takes earlier ones). */
private fun openTasksFor(tasks: List<Task>, date: String, today: String): List<Task> = tasks.filter { task ->
    if (task.parentTaskId != null && task.dueDate == null) return@filter false
    if (task.status == "completed" || task.status == "cancelled") return@filter false
    val due = task.dueDate ?: return@filter false
    if (date == today) due <= today else due == date
}

/** One list a day at [ReminderSettings.taskTime] of what's due; days with nothing get nothing. */
fun taskSummaries(tasks: List<Task>, today: LocalDate, time: String, now: Long, zone: ZoneId = ZoneId.systemDefault(), days: Int = 7): List<Planned> {
    val at = hhmm(time)
    return (0 until days).mapNotNull { offset ->
        val day = today.plusDays(offset.toLong())
        val ring = day.atTime(at).atZone(zone).toInstant().toEpochMilli()
        if (ring <= now) return@mapNotNull null
        val due = openTasksFor(tasks, day.toString(), today.toString())
        if (due.isEmpty()) return@mapNotNull null
        val names = due.take(3).joinToString(", ") { it.title }
        val more = if (due.size > 3) " and ${due.size - 3} more" else ""
        Planned("tasks-$day", ring, "${due.size} ${if (due.size == 1) "task" else "tasks"} due today", "$names$more.", Channel.Tasks, "do")
    }
}

/** A reminder at the time of each open task that has one, in the next [days] days. */
fun timedTasks(tasks: List<Task>, now: Long, zone: ZoneId = ZoneId.systemDefault(), days: Int = 7): List<Planned> {
    val until = now + days * DAY
    return tasks.mapNotNull { task ->
        val date = task.dueDate ?: return@mapNotNull null
        val time = task.dueTime ?: return@mapNotNull null
        if (task.status == "completed" || task.status == "cancelled") return@mapNotNull null
        val at = runCatching { LocalDate.parse(date.take(10)).atTime(hhmm(time)).atZone(zone).toInstant().toEpochMilli() }.getOrNull() ?: return@mapNotNull null
        if (at <= now || at > until) return@mapNotNull null
        Planned("task-${task.id}-$at", at, task.title, "Task · now", Channel.Tasks, "task:${task.id}")
    }
}

/** Water reminders for today and tomorrow, every [every] minutes (at least 15) from [from] to [to]. */
fun waterTimes(every: Int, from: String, to: String, today: LocalDate, now: Long, zone: ZoneId = ZoneId.systemDefault(), days: Int = 2): List<Planned> {
    val step = maxOf(15, every)
    val start = hhmm(from).toSecondOfDay() / 60
    val end = hhmm(to).toSecondOfDay() / 60
    if (end <= start) return emptyList()
    val out = mutableListOf<Planned>()
    for (offset in 0 until days) {
        val day = today.plusDays(offset.toLong())
        var minute = start
        while (minute <= end) {
            val at = day.atStartOfDay(zone).toInstant().toEpochMilli() + minute * MINUTE
            if (at > now) out += Planned("water-$day-$minute", at, "Water", "A glass of water.", Channel.Tasks, "today")
            minute += step
        }
    }
    return out
}

/** The next step of a repeating reminder (Friday and Saturday are the weekend for "weekdays", as on the web). */
private fun step(at: LocalDateTime, repeat: String): LocalDateTime = when (repeat) {
    "daily" -> at.plusDays(1)
    "weekly" -> at.plusWeeks(1)
    "monthly" -> at.plusMonths(1)
    "weekdays" -> {
        var next = at.plusDays(1)
        while (next.dayOfWeek == DayOfWeek.FRIDAY || next.dayOfWeek == DayOfWeek.SATURDAY) next = next.plusDays(1)
        next
    }
    else -> at
}

private fun parseStamp(value: String, zone: ZoneId): LocalDateTime? =
    runCatching { OffsetDateTime.parse(value).atZoneSameInstant(zone).toLocalDateTime() }.getOrNull()
        ?: runCatching { LocalDateTime.parse(value.take(19)) }.getOrNull()

/** The next times a reminder rings after [from], at most [limit], until [until] (the web's upcomingTimes). */
fun upcomingTimes(reminder: Reminder, from: Long, limit: Int, until: Long?, zone: ZoneId = ZoneId.systemDefault()): List<Long> {
    var at = parseStamp(reminder.remindAt, zone) ?: return emptyList()
    fun millis(t: LocalDateTime) = t.atZone(zone).toInstant().toEpochMilli()
    if (reminder.repeat == "none" || reminder.repeat.isBlank()) {
        val t = millis(at)
        return if (reminder.doneAt == null && t > from && (until == null || t <= until)) listOf(t) else emptyList()
    }
    val doneAt = reminder.doneAt?.let { parseStamp(it, zone) }?.let(::millis)
    val times = mutableListOf<Long>()
    var guard = 0
    while (guard++ < 2000 && times.size < limit) {
        val t = millis(at)
        if (until != null && t > until) break
        val skipped = doneAt != null && t <= doneAt
        val weekend = reminder.repeat == "weekdays" && (at.dayOfWeek == DayOfWeek.FRIDAY || at.dayOfWeek == DayOfWeek.SATURDAY)
        if (t > from && !skipped && !weekend) times += t
        at = step(at, reminder.repeat)
    }
    return times
}

/** Your own reminders for the next [days] days; they ring whatever the prayer settings are. */
fun userReminders(reminders: List<Reminder>, now: Long, zone: ZoneId = ZoneId.systemDefault(), days: Int = 7): List<Planned> =
    reminders.flatMap { reminder ->
        upcomingTimes(reminder, now, 14, now + days * DAY, zone).map { at ->
            Planned("reminder-${reminder.id}-$at", at, reminder.title, reminder.note?.trim()?.takeIf { it.isNotEmpty() } ?: "Reminder", Channel.Tasks, "reminders")
        }
    }

/** Everything to ring in the next week, earliest first, as one list. */
fun reminderPlan(
    settings: ReminderSettings,
    modulesOn: (String) -> Boolean,
    place: PrayerSettings?,
    logs: List<PrayerLog>,
    dhikr: List<DhikrLog>,
    tasks: List<Task>,
    reminders: List<Reminder>,
    today: LocalDate,
    now: Long,
    zone: ZoneId = ZoneId.systemDefault(),
    twentyFour: Boolean = true,
): List<Planned> {
    val out = mutableListOf<Planned>()
    if (modulesOn("spirit")) out += prayerReminders(settings, place, logs, dhikr, today, now, zone, twentyFour)
    if (settings.tasksEnabled && modulesOn("do")) {
        out += taskSummaries(tasks, today, settings.taskTime, now, zone)
        out += timedTasks(tasks, now, zone)
    }
    if (settings.water) out += waterTimes(settings.waterEvery, settings.waterFrom, settings.waterTo, today, now, zone)
    out += userReminders(reminders, now, zone)
    return out.sortedBy { it.at }
}
