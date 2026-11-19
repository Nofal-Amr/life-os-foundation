package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.TimeEntry
import app.lifeos.kt.core.model.Transaction
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Time and Insights behave as on the website (src/data/time.ts, src/data/insights.ts). */
class TimeInsightsTest {
    private val zone = ZoneId.of("Africa/Cairo")

    @Test fun minutesAndClocks() {
        assertEquals("45 min", formatMinutes(45))
        assertEquals("2 h", formatMinutes(120))
        assertEquals("1 h 20", formatMinutes(80))
        assertEquals("01:02:03", formatClock(3_723_000))
        val entry = TimeEntry("e", startedAt = "2026-11-19T08:00:00Z", endedAt = "2026-11-19T08:45:00Z")
        assertEquals(45, entryMinutes(entry))
        val running = TimeEntry("r", startedAt = "2026-11-19T08:00:00Z")
        assertEquals(10, entryMinutes(running, java.time.Instant.parse("2026-11-19T08:10:00Z").toEpochMilli()))
    }

    @Test fun timeGroupsByDayAndActivity() {
        val days = daysEnding(LocalDate.parse("2026-11-19"), 2)
        val entries = listOf(
            TimeEntry("a", startedAt = "2026-11-18T08:00:00Z", endedAt = "2026-11-18T09:00:00Z", activityId = "read"),
            TimeEntry("b", startedAt = "2026-11-19T08:00:00Z", endedAt = "2026-11-19T08:30:00Z", activityId = "read"),
            TimeEntry("c", startedAt = "2026-11-19T10:00:00Z", endedAt = "2026-11-19T10:20:00Z", taskId = "t1"),
        )
        assertEquals(listOf(60, 50), minutesByDay(entries, days, zone = zone))
        assertEquals(listOf("a:read" to 90, "t:t1" to 20), minutesByKey(entries, days, zone = zone))
    }

    @Test fun correlationNeedsFourteenDaysAndSpread() {
        val up = (1..14).map { it.toDouble() }
        assertNull(correlation(up.take(13), up.take(13)))
        assertEquals(1.0, correlation(up, up)!!.first, 1e-9)
        assertNull(correlation(up, List(14) { 3.0 }))
        val gaps: List<Double?> = up.mapIndexed { i, v -> if (i % 2 == 0) null else v }
        assertNull(correlation(gaps, up))
    }

    @Test fun pairingsAreWordedAsPatternsNotCauses() {
        val a = Series("sleep", "hours of sleep", (1..20).map { it.toDouble() })
        val b = Series("tasks", "tasks done", (1..20).map { it * 2.0 })
        val c = Series("spent", "spent", (1..20).map { if (it % 2 == 0) 5.0 else 1.0 })
        val list = pairings(listOf(a, b, c))
        assertEquals("strong", list.first().strength)
        assertEquals("On days with more hours of sleep, tasks done tended to be higher too.", pairingLine(list.first()))
        for (p in list) assertTrue(!pairingLine(p).contains("because") && !pairingLine(p).contains("cause"))
    }

    @Test fun monthsCountWhatWasDone() {
        val rows = byMonth(
            Sources(
                tasks = listOf(Task("t", "T", status = "completed", completedAt = "2026-11-02T10:00:00Z"), Task("u", "U", status = "todo")),
                prayerLogs = listOf(PrayerLog("p", "2026-10-05", "fajr", status = "on_time"), PrayerLog("q", "2026-10-05", "asr", status = "missed")),
                transactions = listOf(Transaction("x", "acc", -50.0, "expense", date = "2026-11-03"), Transaction("y", "acc", 900.0, "income", date = "2026-11-03")),
                habitLogs = listOf(HabitLog("h", "habit", "2026-11-01")),
                habits = emptyList(),
                samples = emptyList(),
            ),
            LocalDate.parse("2026-11-19"), months = 2, zone = zone,
        )
        assertEquals(listOf(YearMonth.of(2026, 10), YearMonth.of(2026, 11)), rows.map { it.month })
        assertEquals(1, rows[0].prayed)
        assertEquals(1, rows[1].tasksDone)
        assertEquals(50.0, rows[1].spent, 0.0)
        assertEquals(1, rows[1].habitCheckIns)
    }

    @Test fun dailySeriesKeepsOneValuePerDay() {
        val today = LocalDate.parse("2026-11-19")
        val series = dailySeries(
            Sources(
                tasks = listOf(Task("t", "T", status = "completed", completedAt = "2026-11-19T10:00:00Z"), Task("u", "U", status = "completed", completedAt = "2026-11-19T11:00:00Z")),
                prayerLogs = listOf(PrayerLog("p", "2026-11-18", "fajr", status = "on_time"), PrayerLog("q", "2026-11-18", "asr", status = "missed")),
                transactions = listOf(Transaction("x", "acc", -50.0, "expense", date = "2026-11-19")),
                habitLogs = emptyList(), habits = emptyList(), samples = emptyList(),
            ),
            today, days = 3, zone = zone,
        )
        for (s in series) assertEquals(s.key, 3, s.values.size)
        assertEquals(listOf(null, 0.0, 2.0), series.first { it.key == "tasks" }.values)
        assertEquals(listOf(null, 1.0, null), series.first { it.key == "prayed" }.values)
        assertEquals(listOf(null, 0.0, 50.0), series.first { it.key == "spent" }.values)
    }

    @Test fun habitWeekdaysSkipDaysBeforeItExisted() {
        val today = LocalDate.parse("2026-11-19") // Thursday
        val logs = listOf(HabitLog("1", "h", "2026-11-19"), HabitLog("2", "h", "2026-11-12"))
        val pattern = habitByWeekday("h", LocalDate.parse("2026-11-10"), logs, today, weeks = 8)
        assertEquals(WeekdayPattern(4, 2, 2), pattern[4])
        assertEquals(WeekdayPattern(2, 0, 2), pattern[2])
        assertEquals(WeekdayPattern(1, 0, 1), pattern[1])
    }
}
