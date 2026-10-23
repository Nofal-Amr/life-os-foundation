package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.data.postponed
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TaskLogicTest {
    private val today = LocalDate.parse("2026-10-23")

    private fun task(title: String, due: String? = null, status: String = "todo", completedAt: String? = null, parent: String? = null, time: String? = null) =
        Task(id = title, title = title, status = status, dueDate = due, dueTime = time, parentTaskId = parent, completedAt = completedAt)

    @Test
    fun groupsInOrderAndSkipsStepsAndOldDone() {
        val groups = groupTasks(
            listOf(
                task("Later", "2026-10-30"),
                task("Before", "2026-10-20"),
                task("Now", "2026-10-23"),
                task("Whenever"),
                task("Step", "2026-10-23", parent = "x"),
                task("Done now", status = "completed", completedAt = "2026-10-23T06:00:00+00:00"),
                task("Done before", status = "completed", completedAt = "2026-10-01T06:00:00+00:00"),
                task("Dropped", "2026-10-23", status = "cancelled"),
            ),
            today,
            ZoneOffset.UTC,
        )
        assertEquals(
            listOf(
                TaskGroup.Overdue to listOf("Before"),
                TaskGroup.Today to listOf("Now"),
                TaskGroup.Upcoming to listOf("Later"),
                TaskGroup.NoDate to listOf("Whenever"),
                TaskGroup.DoneToday to listOf("Done now"),
            ),
            groups.map { (group, rows) -> group to rows.map { it.title } },
        )
    }

    @Test
    fun detailStatesTheDateNotAVerdict() {
        assertEquals("From 20 Oct", dueDetail(task("a", "2026-10-20"), today))
        assertEquals("Yesterday", dueDetail(task("a", "2026-10-22"), today))
        assertEquals("11:00", dueDetail(task("a", "2026-10-23", time = "11:00:00"), today))
        assertEquals("Today", dueDetail(task("a", "2026-10-23"), today))
        assertEquals("Tomorrow · 09:30", dueDetail(task("a", "2026-10-24", time = "09:30:00"), today))
        assertNull(dueDetail(task("a"), today))
    }

    @Test
    fun nextActionIsTheOldestDatedOpenTask() {
        val next = nextAction(listOf(task("Soon", "2026-10-25"), task("Old", "2026-10-01"), task("Step", "2026-09-01", parent = "x"), task("Undated")))
        assertEquals("Old", next?.title)
    }

    @Test
    fun movingLaterIsRecordedOnceWithTheOriginalDate() {
        val first = postponed(task("a", "2026-10-23"), "2026-10-24")
        assertEquals(1, first.postponedCount)
        assertEquals("2026-10-23", first.originalDueDate)
        val second = postponed(first, "2026-10-26")
        assertEquals(2, second.postponedCount)
        assertEquals("2026-10-23", second.originalDueDate)
        // Earlier, or clearing it, isn't a postponement.
        assertEquals(0, postponed(task("b", "2026-10-23"), "2026-10-20").postponedCount)
        assertEquals(0, postponed(task("c", "2026-10-23"), null).postponedCount)
    }
}

class MoneyLogicTest {
    private val cash = Account(id = "cash", name = "Cash", openingBalance = 100.0)
    private val fund = Account(id = "fund", name = "Home fund", openingBalance = 500.0, countsTowardSpendable = false)
    private val closed = Account(id = "old", name = "Old", openingBalance = 50.0, active = false)
    private val moves = listOf(
        Transaction(id = "1", accountId = "cash", amount = -30.0, kind = "expense", date = "2026-10-23"),
        Transaction(id = "2", accountId = "cash", amount = 200.0, kind = "income", date = "2026-10-01"),
        Transaction(id = "3", accountId = "fund", amount = -20.0, kind = "expense", date = "2026-09-30"),
    )

    @Test
    fun balancesAndLeftToSpendFollowTheWebRules() {
        assertEquals(270.0, accountBalance(cash, moves), 0.001)
        assertEquals(480.0, accountBalance(fund, moves), 0.001)
        assertEquals(270.0, leftToSpend(listOf(cash, fund, closed), moves), 0.001)
    }

    @Test
    fun spendingCountsExpensesByDayAndMonth() {
        assertEquals(30.0, spentDuring(moves, "2026-10-23"), 0.001)
        assertEquals(30.0, spentDuring(moves, "2026-10"), 0.001)
        assertEquals(20.0, spentDuring(moves, "2026-09"), 0.001)
    }

    @Test
    fun expensesAreStoredNegative() {
        assertEquals(-12.5, signedAmount(12.5, "expense"), 0.0)
        assertEquals(12.5, signedAmount(-12.5, "income"), 0.0)
    }
}

class PrayerLogicTest {
    private val cairo = app.lifeos.kt.core.model.PrayerSettings(id = "p", latitude = 30.0444, longitude = 31.2357, calcMethod = "Egyptian")
    private val zone = java.time.ZoneId.of("Africa/Cairo")
    private val day = LocalDate.parse("2026-10-23")

    @Test
    fun ishaPointsSplitTheTimeFromIshaToTheNextFajr() {
        val isha = prayerTimes(cairo, day, zone)!!.first { it.key == "isha" }.at.time
        val w = prayerWindows(cairo, day, zone)!!
        val span = w.nextFajr.time - isha
        // To the second: the library's own sub-second rounding can differ between runs.
        assertEquals((isha + span / 3) / 1000, w.ishaFirstThird.time / 1000)
        assertEquals((isha + span / 2) / 1000, w.ishaHalf.time / 1000)
        assertEquals(true, w.ishaFirstThird.before(w.ishaHalf) && w.ishaHalf.before(w.nextFajr))
    }

    @Test
    fun sunriseFallsBetweenFajrAndDhuhr() {
        val times = prayerTimes(cairo, day, zone)!!
        val w = prayerWindows(cairo, day, zone)!!
        assertEquals(true, w.sunrise.after(times.first { it.key == "fajr" }.at) && w.sunrise.before(times.first { it.key == "dhuhr" }.at))
    }

    @Test
    fun noPlaceMeansNoTimes() {
        assertNull(prayerWindows(null, day))
        assertNull(prayerTimes(app.lifeos.kt.core.model.PrayerSettings(id = "p"), day))
    }
}

class NoteLogicTest {
    private fun note(id: String, tags: List<String>, pinned: Boolean = false, updated: String = "2026-10-01", archived: Boolean = false) =
        app.lifeos.kt.core.model.Note(id = id, title = id, tags = tags, pinned = pinned, updatedAt = updated, archived = archived)

    @Test
    fun hashtagsBecomeLabelsButNotFromLockedNotes() {
        assertEquals(listOf("work", "مشروع"), hashtagsIn("Call #work about #مشروع, again #work. Not a#tag"))
        assertEquals(listOf("Work", "plan"), labelsFor(listOf("Work"), "see #plan and #work", locked = false))
        assertEquals(listOf("Passwords"), labelsFor(listOf("#Passwords"), "pin #1234 #bank", locked = true))
    }

    @Test
    fun aFocusLabelShowsOnlyThoseNotesPinnedFirst() {
        val notes = listOf(note("a", listOf("Work")), note("b", listOf("Home")), note("c", listOf("work"), pinned = true), note("d", listOf("Work"), archived = true))
        assertEquals(listOf("c", "a"), filterNotes(notes, "Work", "") { it.title }.map { it.id })
        assertEquals(listOf("c", "a", "b"), filterNotes(notes, null, "") { it.title }.map { it.id })
        assertEquals(listOf("b"), filterNotes(notes, null, "b") { it.title }.map { it.id })
    }

    @Test
    fun labelsAreListedMostUsedFirst() {
        assertEquals(listOf("Work", "Home"), allLabels(listOf(note("a", listOf("Work")), note("b", listOf("Work", "Home")))))
    }
}
