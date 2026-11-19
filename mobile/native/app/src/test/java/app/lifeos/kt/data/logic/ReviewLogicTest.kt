package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.DailyReview
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/** Reflect, Close the day and the week recap behave as on the website. */
class ReviewLogicTest {
    private val zone = ZoneId.of("Africa/Cairo")

    @Test fun reflectionsAddLinesWithoutLosingAny() {
        assertEquals("One", appendLine(null, " One "))
        assertEquals("One\nTwo", appendLine("One\n", "Two"))
        val review = withReflection(withReflection(DailyReview("r", "2026-11-19"), ReflectionKind.Good, "Shipped it"), ReflectionKind.Good, "Called mum")
        assertEquals(listOf("Shipped it", "Called mum"), linesOf(review.wins))
        assertEquals(listOf("Rain"), linesOf(withReflection(review, ReflectionKind.Hard, "Rain").challenges))
    }

    @Test fun theDayGathersReviewLinesAndThatDaysNotes() {
        val review = DailyReview("r", "2026-11-19", wins = "A", gratitude = "B")
        val notes = listOf(
            Note("n1", body = "An idea", tags = listOf("idea"), createdAt = "2026-11-19T08:00:00Z"),
            Note("n2", body = "Other day", tags = listOf("reflection"), createdAt = "2026-11-18T08:00:00Z"),
            Note("n3", body = "Not a reflection", tags = listOf("work"), createdAt = "2026-11-19T09:00:00Z"),
        )
        assertEquals(
            listOf(ReflectionLine("Good", "A"), ReflectionLine("Grateful", "B"), ReflectionLine("Idea", "An idea")),
            dayReflections(review, notes, "2026-11-19", zone),
        )
    }

    @Test fun closingTheDayTakesOpenTopLevelTasksDatedTodayOrEarlier() {
        val tasks = listOf(
            Task("a", "Old", status = "todo", dueDate = "2026-11-17"),
            Task("b", "Today later", status = "todo", dueDate = "2026-11-19", dueTime = "18:00"),
            Task("c", "Today early", status = "todo", dueDate = "2026-11-19", dueTime = "08:00"),
            Task("d", "Done", status = "completed", dueDate = "2026-11-19"),
            Task("e", "Tomorrow", status = "todo", dueDate = "2026-11-20"),
            Task("f", "Step", status = "todo", dueDate = "2026-11-19", parentTaskId = "a"),
            Task("g", "Undated", status = "todo"),
        )
        assertEquals(listOf("a", "c", "b"), carryOver(tasks, "2026-11-19").map { it.id })
    }

    @Test fun weekStartsFollowTheWebNumbering() {
        val thursday = LocalDate.parse("2026-11-19")
        assertEquals(LocalDate.parse("2026-11-14"), weekStartOf(thursday, 6)) // Saturday
        assertEquals(LocalDate.parse("2026-11-15"), weekStartOf(thursday, 0)) // Sunday
        assertEquals(LocalDate.parse("2026-11-16"), weekStartOf(thursday, 1)) // Monday
        assertEquals(thursday, weekStartOf(thursday, 4))
    }

    @Test fun weekRecapCountsOnlyWhatWasLogged() {
        val start = LocalDate.parse("2026-11-14")
        val today = LocalDate.parse("2026-11-16") // three days have started
        val tasks = listOf(
            Task("a", "A", status = "completed", dueDate = "2026-11-15", completedAt = "2026-11-15T10:00:00Z"),
            Task("b", "B", status = "completed", dueDate = "2026-11-15", completedAt = "2026-11-15T12:00:00Z"),
            Task("c", "C", status = "todo", dueDate = "2026-11-18"),
        )
        val habits = listOf(Habit("h", "Walk"))
        val logs = listOf(HabitLog("l1", "h", "2026-11-14"), HabitLog("l2", "h", "2026-11-15"))
        val prayers = listOf(PrayerLog("p1", "2026-11-14", "fajr", status = "on_time"), PrayerLog("p2", "2026-11-14", "asr", status = "missed"))
        val spent = listOf(Transaction("t", "acc", -125.0, "expense", date = "2026-11-15"))
        val week = weekCounts(start, today, tasks, habits, logs, prayers, spent, trackPrayers = true, zone = zone)
        val lines = weekRecap(week) { "EGP ${it.toInt()}" }
        assertEquals(
            listOf(
                "2 of 3 tasks this week are done.",
                "Most tasks finished on Sunday (2).",
                "2 of 3 daily habit check-ins logged so far.",
                "1 of 15 prayers logged so far.",
                "EGP 125 spent across 1 day.",
            ),
            lines,
        )
        for (line in lines) assertFalse(line, line.lowercase().contains("missed") || line.lowercase().contains("streak"))
    }
}
