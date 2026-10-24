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
                TaskGroup.Earlier to listOf("Before"),
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
        assertEquals("3 days ago", dueDetail(task("a", "2026-10-20"), today))
        assertEquals("Yesterday", dueDetail(task("a", "2026-10-22"), today))
        assertEquals("Today · 11:00", dueDetail(task("a", "2026-10-23", time = "11:00:00"), today))
        assertEquals("Today", dueDetail(task("a", "2026-10-23"), today))
        assertEquals("Tomorrow · 09:30", dueDetail(task("a", "2026-10-24", time = "09:30:00"), today))
        assertNull(dueDetail(task("a"), today))
    }

    @Test
    fun nextActionIsTheOldestDatedOpenTask() {
        val next = nextAction(listOf(task("Soon", "2026-10-25"), task("Old", "2026-10-01"), task("Step", "2026-09-01", parent = "x"), task("Undated")), today)
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

class TodayRulesTest {
    private val today = LocalDate.parse("2026-10-23")
    private fun task(id: String, due: String? = null, priority: String = "medium", energy: Int? = null, parent: String? = null, created: String = "2026-10-01T09:00:00Z", status: String = "todo", minutes: Int? = null, position: Int = 0, postponed: Int = 0, updated: String? = null) =
        Task(id = id, title = id, dueDate = due, priority = priority, energy = energy, parentTaskId = parent, createdAt = created, status = status, estimatedMinutes = minutes, position = position, postponedCount = postponed, updatedAt = updated ?: created)

    @Test
    fun theNextActionIsTheFirstOpenStepOfTheMostUrgentTask() {
        val tasks = listOf(task("Later", "2026-10-30", "critical"), task("Late", "2026-10-20"), task("s2", parent = "Late", position = 1), task("s1", parent = "Late", position = 0))
        val first = nextActions(tasks, today).first()
        assertEquals("s1", first.item.id)
        assertEquals("Late", first.parent.id)
    }

    @Test
    fun withinTheSameDayWhatFitsYourEnergyComesBeforePriority() {
        val tasks = listOf(task("Heavy", "2026-10-23", "high", energy = 3), task("Light", "2026-10-23", "low", energy = 1))
        assertEquals("Light", nextActions(tasks, today, capacity = energyCapacity(2)).first().item.id)
        assertEquals("Heavy", nextActions(tasks, today, capacity = null).first().item.id)
    }

    @Test
    fun aTaskMovedTwiceAndTwoWeeksOldIsStuckButNotOneWithARecentStep() {
        val tasks = listOf(
            task("Kaitech", created = "2026-09-20T09:00:00Z", postponed = 3),
            task("Fresh", created = "2026-10-20T09:00:00Z", postponed = 5),
            task("Moving", created = "2026-09-01T09:00:00Z", postponed = 2),
            task("step", parent = "Moving", status = "completed").copy(completedAt = "2026-10-21T09:00:00Z"),
        )
        assertEquals(listOf("Kaitech"), stuckTasks(tasks, today).map { it.task.id })
        assertEquals("Moved 3 times", stuckTasks(tasks, today).first().detail)
    }

    @Test
    fun paydayOnThe31stFallsOnTheMonthsLastDay() {
        val config = app.lifeos.kt.core.model.PaydayConfig(id = "p", schedule = "monthly", payDay = 31)
        assertEquals(LocalDate.parse("2026-10-31"), nextPayday(config, today))
        assertEquals(LocalDate.parse("2026-11-30"), nextPayday(config, LocalDate.parse("2026-11-02")))
        assertEquals(LocalDate.parse("2026-09-30"), previousPayday(config, today))
    }

    @Test
    fun leftBeforePaydayCountsEachTimeACostComesRoundAndSkipsCredit() {
        val cash = Account(id = "cash", name = "Cash", openingBalance = 5000.0)
        val card = Account(id = "card", name = "Card", type = "credit", openingBalance = 9000.0)
        val gym = app.lifeos.kt.core.model.RecurringCost(id = "g", name = "Gym", amount = -100.0, frequency = "weekly", nextDueDate = "2026-10-24")
        val totals = availableBeforePayday(listOf(cash, card), emptyList(), listOf(gym), LocalDate.parse("2026-11-07"), 500.0)
        assertEquals(5000.0, totals.liquid, 0.0)
        assertEquals(listOf("2026-10-24", "2026-10-31", "2026-11-07"), totals.upcoming.single().dates)
        assertEquals(300.0, totals.committed, 0.0)
        assertEquals(4200.0, totals.available, 0.0)
    }

    @Test
    fun theRingCountsOnlyWhatWasPlannedForToday() {
        val tasks = listOf(task("due", "2026-10-23"), task("done", "2026-10-23", status = "completed").copy(completedAt = "2026-10-23T08:00:00Z"), task("later", "2026-10-30"))
        val ring = todayRing(today, tasks, emptyList(), emptyList(), 2, null, ZoneOffset.UTC)
        assertEquals(listOf("tasks" to (1 to 2), "prayers" to (2 to 5)), ring.map { it.key to (it.done to it.total) })
    }
}

class MoneyFormatTest {
    @Test
    fun matchesTheWebsite() {
        val egp = app.lifeos.kt.core.common.MoneyFormatter("EGP", java.util.Locale.US)
        assertEquals("EGP 13,439", egp.format(13439.0))
        assertEquals("-EGP 600", egp.format(-600.0))
        assertEquals("EGP 12.50", egp.format(12.5))
        assertEquals("1,250", app.lifeos.kt.core.common.MoneyFormatter(null, java.util.Locale.US).format(1250.0))
    }
}

class DoRulesTest {
    private val today = LocalDate.parse("2026-10-23") // a Friday
    private fun task(id: String, due: String? = null, status: String = "todo", completedAt: String? = null, parent: String? = null) =
        Task(id = id, title = id, dueDate = due, status = status, completedAt = completedAt, parentTaskId = parent)

    @Test
    fun filtersMatchTheWebsite() {
        val tasks = listOf(task("today", "2026-10-23"), task("later", "2026-10-30"), task("before", "2026-10-01"), task("unsorted", status = "inbox"), task("done", "2026-10-23", "completed"), task("step", "2026-10-23", parent = "today"))
        assertEquals(listOf("today"), filterTasks(tasks, TaskFilter.Today, today).map { it.id })
        assertEquals(listOf("later"), filterTasks(tasks, TaskFilter.Upcoming, today).map { it.id })
        assertEquals(listOf("before"), filterTasks(tasks, TaskFilter.Earlier, today).map { it.id })
        assertEquals(listOf("unsorted"), filterTasks(tasks, TaskFilter.Unsorted, today).map { it.id })
        assertEquals(listOf("done"), filterTasks(tasks, TaskFilter.Completed, today).map { it.id })
        assertEquals(5, filterTasks(tasks, TaskFilter.All, today).size)
    }

    @Test
    fun repeatsLandOnTheNextRealDate() {
        assertEquals("2026-10-25", nextRepeatDate("2026-10-23", "weekdays")) // Friday → Sunday, skipping the weekend
        assertEquals("2026-02-28", nextRepeatDate("2026-01-31", "monthly"))
        assertEquals("2026-10-30", nextRepeatDate("2026-10-23", "weekly"))
        assertEquals("2026-10-24", nextRepeatDate("2026-10-23", "daily"))
    }

    @Test
    fun aPastedListBecomesOneTaskPerLine() {
        assertEquals(listOf("Milk", "Call the bank", "Pay rent"), splitTaskLines("- Milk\n2. Call the bank\n\n• Pay rent  "))
    }

    @Test
    fun weeklyCountsDropLeadingEmptyWeeksAndSkipSteps() {
        val tasks = listOf(
            task("a", status = "completed", completedAt = "2026-10-21T10:00:00Z"),
            task("b", status = "completed", completedAt = "2026-10-13T10:00:00Z"),
            task("s", status = "completed", completedAt = "2026-10-13T10:00:00Z", parent = "b"),
        )
        val weeks = tasksCompletedPerWeek(tasks, today, zone = ZoneOffset.UTC)
        assertEquals(listOf(LocalDate.parse("2026-10-12") to 1, LocalDate.parse("2026-10-19") to 1), weeks)
    }

    @Test
    fun habitAreasAreGuessedFromTheName() {
        assertEquals("home", guessHabitCategory("Water the plants"))
        assertEquals("health", guessHabitCategory("Walk 30 minutes"))
        assertEquals("mind", guessHabitCategory("Read 10 pages"))
        assertEquals("other", guessHabitCategory("No phone after 11pm"))
        assertEquals("spirit", habitCategory("Anything", "spirit"))
    }

    @Test
    fun aPlanSpreadsItsTasksFromToday() {
        val plan = PLANS.first { it.id == "declutter-7" }
        val tasks = planTasks(plan, today)
        assertEquals(7, tasks.size)
        assertEquals("Clear the entrance and shoes" to "2026-10-23", tasks.first())
        assertEquals("2026-10-29", tasks.last().second)
    }
}

class MoneyOverviewTest {
    private fun cost(amount: Double, unit: String, count: Int = 1, active: Boolean = true) =
        app.lifeos.kt.core.model.RecurringCost("c", "Cost", amount, active = active, intervalCount = count, intervalUnit = unit, nextDueDate = "2026-10-30")

    @Test fun monthlyEquivalentSpreadsEachInterval() {
        assertEquals(600.0, monthlyEquivalent(cost(600.0, "month")), 0.001)
        assertEquals(100.0 * 365.25 / 12 / 7, monthlyEquivalent(cost(100.0, "week")), 0.001)
        assertEquals(1200.0 / 12, monthlyEquivalent(cost(1200.0, "year")), 0.001)
        assertEquals(300.0, monthlyEquivalent(cost(600.0, "month", count = 2)), 0.001)
        assertEquals(0.0, monthlyEquivalent(cost(600.0, "month", active = false)), 0.001)
    }

    @Test fun paydayCycleCountsFromTheLastPayday() {
        val config = app.lifeos.kt.core.model.PaydayConfig("p", schedule = "monthly", payDay = 25)
        val cycle = paydayCycle(config, LocalDate.of(2026, 10, 23))!!
        assertEquals(LocalDate.of(2026, 9, 25), cycle.start)
        assertEquals(LocalDate.of(2026, 10, 25), cycle.end)
        assertEquals(28L, cycle.elapsed)
        assertEquals(30L, cycle.total)
        // On payday a new cycle starts.
        assertEquals(0L, paydayCycle(config, LocalDate.of(2026, 10, 25))!!.elapsed)
    }

    @Test fun weeklySpendKeepsTheTopCategoriesAndGroupsTheRest() {
        val cats = (1..7).map { app.lifeos.kt.core.model.FinanceCategory("k$it", "Cat $it") }
        val today = LocalDate.of(2026, 10, 23) // a Friday; its week starts Monday 19 Oct
        val tx = (1..7).map { Transaction("t$it", "a", -it * 10.0, categoryId = "k$it", date = "2026-10-20") } +
            Transaction("u", "a", -5.0, date = "2026-10-13") +
            Transaction("in", "a", 999.0, kind = "income", date = "2026-10-20")
        val w = weeklySpendByCategory(tx, cats, today)
        assertEquals(listOf(LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 19)), w.weeks)
        assertEquals(listOf("k7", "k6", "k5", "k4", "k3", "other"), w.series.map { it.first })
        assertEquals(30.0, w.values[1]["other"]!!, 0.001) // 10 + 20 from the two smallest
        assertEquals(5.0, w.values[0]["other"]!!, 0.001) // uncategorised falls outside the top five
    }
}

class BodyRulesTest {
    private fun med(id: String, vararg times: String, active: Boolean = true) = app.lifeos.kt.core.model.Medication(id, id, active = active, scheduleTimes = times.toList())
    private fun dose(med: String, slot: String, taken: Boolean = true) = app.lifeos.kt.core.model.MedicationLog("l$med$slot", med, "2026-10-24", slot, taken)

    @Test fun dosesCountEachScheduledTimeOnce() {
        val meds = listOf(med("iron", "09:00", "21:00", "09:00"), med("d", "09:00"), med("off", "08:00", active = false))
        assertEquals(1 to 3, dosesOn(meds, listOf(dose("d", "09:00"), dose("iron", "21:00", taken = false)), "2026-10-24"))
        assertNull(dosesOn(listOf(med("x")), emptyList(), "2026-10-24"))
    }

    @Test fun mealFollowsTheTimeOfDay() {
        assertEquals("breakfast", mealForTime(java.time.LocalTime.of(7, 0)))
        assertEquals("lunch", mealForTime(java.time.LocalTime.of(13, 0)))
        assertEquals("snack", mealForTime(java.time.LocalTime.of(16, 30)))
        assertEquals("dinner", mealForTime(java.time.LocalTime.of(20, 0)))
        assertEquals("snack", mealForTime(java.time.LocalTime.of(2, 0)))
    }

    @Test fun bmiAndDurations() {
        assertEquals(24.1, bmi(178.0, 76.5)!!, 0.05)
        assertNull(bmi(null, 70.0))
        assertEquals("7h 30m", formatDuration(450))
        assertEquals("45m", formatDuration(45))
        assertEquals("—", formatDuration(null))
    }

    @Test fun sleepUsesPreciseMinutesOverOldHours() {
        val logs = listOf(
            app.lifeos.kt.core.model.HealthLog("a", "2026-10-24", sleepHours = 6.0, actualSleepMinutes = 375),
            app.lifeos.kt.core.model.HealthLog("b", "2026-10-23", sleepHours = 7.5),
            app.lifeos.kt.core.model.HealthLog("c", "2026-09-01", sleepHours = 8.0),
        )
        val series = sleepSeries(logs, 14, LocalDate.of(2026, 10, 24))
        assertEquals(listOf(7.5, 6.25), series.map { it.second })
    }

    @Test fun oneOffsAreNewestFirstAndOncePerName() {
        fun log(id: String, name: String, at: String, food: String? = null) = app.lifeos.kt.core.model.FoodLog(id, foodId = food, createdAt = at, logDate = at.take(10), name = name)
        val logs = listOf(log("1", "Koshari", "2026-10-20T10"), log("2", "koshari", "2026-10-22T10"), log("3", "Egg", "2026-10-23T10", food = "f"), log("4", "Croissant", "2026-10-21T10"))
        assertEquals(listOf("2", "4"), recentOneOffs(logs).map { it.id })
    }

    @Test fun referenceSuggestionsPutCuisineDishesFirst() {
        val breakfast = suggestionsFor("breakfast", listOf("egyptian")).map { it.name }
        assertEquals(true, breakfast.indexOf("Ful sandwich") < breakfast.indexOf("Toast bread"))
        assertEquals(false, "Oats, dry" in breakfast) // western only
        assertEquals(50, FOOD_LIBRARY.size)
    }
}

class SpiritRulesTest {
    private fun log(date: String, name: String, status: String?) = app.lifeos.kt.core.model.PrayerLog("$date$name", date, name, status, completed = status != "missed")

    @Test fun qiblaFromCairo() {
        assertEquals(136.0, qiblaBearing(30.0444, 31.2357), 1.0)
        assertEquals(1287.0, distanceToKaabaKm(30.0444, 31.2357), 10.0)
        assertEquals(-10.0, turnTo(350.0, 0.0), 0.001)
        assertEquals(20.0, turnTo(10.0, 350.0), 0.001)
    }

    @Test fun countsAreOfTheFiveOnly() {
        val logs = listOf(log("2026-10-24", "fajr", "on_time"), log("2026-10-24", "sunnah_fajr", "on_time"), log("2026-10-24", "dhuhr", "missed"), log("2026-10-23", "isha", "jamaah"))
        assertEquals(1, prayedOn(logs, "2026-10-24"))
        assertEquals(2, prayedInWeek(logs, LocalDate.of(2026, 10, 24)))
        val (counts, logged) = prayerStatusCounts(logs, "2026-10-23", "2026-10-24")
        assertEquals(3, logged)
        assertEquals(1, counts["missed"])
    }

    @Test fun azkarFileLoadsWithBothTimes() {
        val data = parseAzkar(java.io.File("src/main/assets/azkar.json").readText(Charsets.UTF_8))
        assertEquals(20, data.azkar.size)
        assertEquals(listOf(33, 99, 100, 1000), data.tasbihTargets)
        val morning = azkarFor(data, "morning").map { it.first.id }
        val evening = azkarFor(data, "evening").map { it.first.id }
        assertEquals(true, "ilman" in morning && "ilman" !in evening)
        assertEquals(true, "kalimat" in evening && "kalimat" !in morning)
        assertEquals(19, morning.size)
    }
}
