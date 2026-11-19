package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.core.model.Reminder
import app.lifeos.kt.core.model.Task
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The website's reminder tests (src/data/reminders.test.ts, userReminders.test.ts), ported. */
class ReminderPlanTest {
    private val zone = ZoneId.of("Africa/Cairo")
    private fun at(iso: String) = LocalDateTime.parse(iso).atZone(zone).toInstant().toEpochMilli()
    private fun hour(millis: Long) = java.time.Instant.ofEpochMilli(millis).atZone(zone).hour
    private fun task(title: String, due: String, status: String = "todo") = Task(id = title, title = title, dueDate = due, status = status)

    @Test fun oneSummaryPerDayWithSomethingDue() {
        val list = taskSummaries(listOf(task("A", "2026-09-21"), task("B", "2026-09-23"), task("Done", "2026-09-23", "completed")), LocalDate.parse("2026-09-21"), "09:00", at("2026-09-21T07:00:00"), zone)
        assertEquals(listOf("tasks-2026-09-21", "tasks-2026-09-23"), list.map { it.id })
        assertEquals(at("2026-09-21T09:00:00"), list[0].at)
        assertEquals("1 task due today", list[1].title)
        assertEquals(Channel.Tasks, list[1].channel)
    }

    @Test fun todayTakesEarlierTasksAndNamesThree() {
        val list = taskSummaries(listOf("A", "B", "C", "D").map { task(it, "2026-09-19") }, LocalDate.parse("2026-09-21"), "09:00", at("2026-09-21T07:00:00"), zone)
        assertEquals("4 tasks due today", list[0].title)
        assertEquals("A, B, C and 1 more.", list[0].body)
    }

    @Test fun aPassedTimeIsSkipped() {
        assertTrue(taskSummaries(listOf(task("A", "2026-09-21")), LocalDate.parse("2026-09-21"), "09:00", at("2026-09-21T20:00:00"), zone).isEmpty())
    }

    @Test fun timedTasksRingAtTheirTime() {
        val t = Task(id = "t", title = "Call Omar", status = "todo", dueDate = "2026-09-25", dueTime = "15:30:00")
        val list = timedTasks(listOf(t, t.copy(id = "d", status = "completed"), t.copy(id = "n", dueTime = null)), at("2026-09-25T10:00:00"), zone)
        assertEquals(1, list.size)
        assertEquals(15, hour(list[0].at))
        assertTrue(timedTasks(listOf(t), at("2026-09-25T16:00:00"), zone).isEmpty())
    }

    @Test fun waterEveryNMinutesFromNowOn() {
        val now = at("2026-10-08T13:10:00")
        val day = LocalDate.parse("2026-10-08")
        assertEquals(listOf(15), waterTimes(120, "09:00", "15:00", day, now, zone, days = 1).map { hour(it.at) })
        assertEquals(listOf(15, 9, 12, 15), waterTimes(180, "09:00", "15:00", day, now, zone, days = 2).map { hour(it.at) })
        assertTrue(waterTimes(60, "22:00", "09:00", day, now, zone).isEmpty())
    }

    private fun reminder(repeat: String = "none", done: String? = null) = Reminder("r1", "Call the bank", remindAt = "2026-09-25T15:00:00", repeat = repeat, doneAt = done)

    @Test fun aOneOffRingsOnce() {
        assertEquals(listOf(at("2026-09-25T15:00:00")), upcomingTimes(reminder(), at("2026-09-25T10:00:00"), 1, null, zone))
        assertTrue(upcomingTimes(reminder(done = "2026-09-25T11:00:00"), at("2026-09-25T10:00:00"), 1, null, zone).isEmpty())
        assertTrue(upcomingTimes(reminder(), at("2026-09-25T16:00:00"), 1, null, zone).isEmpty())
    }

    @Test fun dailyRollsForward() {
        assertEquals(listOf(at("2026-09-28T15:00:00"), at("2026-09-29T15:00:00")), upcomingTimes(reminder("daily"), at("2026-09-27T16:00:00"), 2, null, zone))
    }

    @Test fun weekdaysSkipFridayAndSaturday() {
        assertEquals(listOf(at("2026-09-27T15:00:00"), at("2026-09-28T15:00:00")), upcomingTimes(reminder("weekdays"), at("2026-09-24T16:00:00"), 2, null, zone))
    }

    @Test fun doneOnARepeatIsForThatTimeOnly() {
        assertEquals(listOf(at("2026-09-26T15:00:00")), upcomingTimes(reminder("daily", "2026-09-25T15:05:00"), at("2026-09-25T09:00:00"), 1, null, zone))
    }

    private val cairo = PrayerSettings(id = "p", latitude = 30.0444, longitude = 31.2357, city = "Cairo", calcMethod = "Egyptian", asrSchool = "shafi")

    @Test fun prayerRemindersSkipWhatIsLogged() {
        val day = LocalDate.parse("2026-11-19")
        val now = at("2026-11-19T00:30:00")
        val all = prayerReminders(ReminderSettings(), cairo, emptyList(), emptyList(), day, now, zone, days = 1)
        // Five prayers × (early, at the time, before it ends) + two azkar.
        assertEquals(17, all.size)
        assertTrue(all.any { it.id == "2026-11-19-asr-now" && it.prayer?.actions == listOf("jamaah", "on_time") })
        val logged = listOf(PrayerLog("l", "2026-11-19", "asr", status = "on_time"))
        val after = prayerReminders(ReminderSettings(), cairo, logged, emptyList(), day, now, zone, days = 1)
        assertFalse(after.any { it.id.startsWith("2026-11-19-asr") })
        assertEquals(14, after.size)
    }

    @Test fun prayerRemindersAreCalm() {
        val all = prayerReminders(ReminderSettings(), cairo, emptyList(), emptyList(), LocalDate.parse("2026-11-19"), at("2026-11-19T00:30:00"), zone, days = 1)
        for (item in all) {
            val text = (item.title + " " + item.body).lowercase()
            for (word in listOf("missed", "late!", "hurry", "streak", "behind")) assertFalse(text, text.contains(word))
        }
    }

    @Test fun planSkipsAreasThatAreOff() {
        val plan = reminderPlan(ReminderSettings(), { it != "spirit" }, cairo, emptyList(), emptyList(), listOf(task("A", "2026-11-19")), emptyList(), LocalDate.parse("2026-11-19"), at("2026-11-19T00:30:00"), zone)
        assertTrue(plan.none { it.channel == Channel.Prayers })
        assertEquals(1, plan.size)
    }
}
