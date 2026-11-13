package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.AccountPocket
import app.lifeos.kt.core.model.PaydayConfig
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Transaction
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.min

// The web app's rules (src/data/finance.ts), line for line: amounts are signed
// (money out is negative), a balance is the opening balance plus everything
// moved, and "left to spend" is what's liquid minus what's already committed
// before payday minus the buffer the person chose.

fun accountBalance(account: Account, transactions: List<Transaction>, pockets: List<AccountPocket> = emptyList()): Double =
    account.openingBalance +
        pockets.filter { it.accountId == account.id }.sumOf { it.openingBalance } +
        transactions.filter { it.accountId == account.id }.sumOf { it.amount }

/** Active, non-credit accounts that count toward spending (a home fund can be left out). */
fun liquidBalance(accounts: List<Account>, transactions: List<Transaction>, pockets: List<AccountPocket> = emptyList()): Double = accounts
    .filter { it.active && it.type != "credit" && it.countsTowardSpendable }
    .sumOf { accountBalance(it, transactions, pockets) }

/** Money kept apart from left to spend (e.g. a home fund). */
fun separateBalance(accounts: List<Account>, transactions: List<Transaction>, pockets: List<AccountPocket> = emptyList()): Double = accounts
    .filter { it.active && it.type != "credit" && !it.countsTowardSpendable }
    .sumOf { accountBalance(it, transactions, pockets) }

/** Spent on dates starting with [prefix]: a day (2026-10-23) or a month (2026-10). */
fun spentDuring(transactions: List<Transaction>, prefix: String): Double = transactions
    .filter { it.kind == "expense" && it.date.startsWith(prefix) }
    .sumOf { abs(it.amount) }

/** The stored amount for a kind: expenses negative, as the web app saves them. */
fun signedAmount(magnitude: Double, kind: String): Double = if (kind == "expense") -abs(magnitude) else abs(magnitude)

/* ------------------------------- payday ------------------------------- */

fun hasPaydaySetup(config: PaydayConfig?): Boolean = when {
    config == null -> false
    config.schedule == "monthly" -> config.payDay != null
    else -> config.anchorDate != null && config.intervalWeeks != null
}

private fun inMonth(base: LocalDate, day: Int): LocalDate = base.withDayOfMonth(min(day, base.lengthOfMonth()))

/** The next payday on or after [from], or null when nothing is set up. */
fun nextPayday(config: PaydayConfig?, from: LocalDate = LocalDate.now()): LocalDate? {
    if (config == null || !hasPaydaySetup(config)) return null
    if (config.schedule == "monthly") {
        val thisMonth = inMonth(from, config.payDay!!)
        return if (!thisMonth.isBefore(from)) thisMonth else inMonth(from.plusMonths(1), config.payDay)
    }
    val weeks = config.intervalWeeks!!
    var date = LocalDate.parse(config.anchorDate!!.take(10))
    if (weeks <= 0) return if (!date.isBefore(from)) date else null
    while (date.isBefore(from)) date = date.plusWeeks(weeks.toLong())
    return date
}

/** The most recent payday on or before [from], or null. */
fun previousPayday(config: PaydayConfig?, from: LocalDate = LocalDate.now()): LocalDate? {
    if (config == null || !hasPaydaySetup(config)) return null
    if (config.schedule == "monthly") {
        val thisMonth = inMonth(from, config.payDay!!)
        return if (!thisMonth.isAfter(from)) thisMonth else inMonth(from.minusMonths(1), config.payDay)
    }
    val weeks = config.intervalWeeks!!
    if (weeks <= 0) return null
    val previous = nextPayday(config, from)?.minusWeeks(weeks.toLong()) ?: return null
    return if (!previous.isAfter(from)) previous else null
}

fun daysUntil(date: LocalDate, from: LocalDate = LocalDate.now()): Long = ChronoUnit.DAYS.between(from, date)

/* --------------------------- recurring costs --------------------------- */

fun recurringInterval(cost: RecurringCost): Pair<Int, String> {
    val count = maxOf(1, cost.intervalCount)
    if (cost.intervalUnit != null && cost.intervalUnit != "hour") return count to cost.intervalUnit
    return when (cost.frequency) {
        "daily" -> 1 to "day"
        "weekly" -> 1 to "week"
        "yearly" -> 1 to "year"
        else -> 1 to "month"
    }
}

fun advanceDate(date: String, count: Int, unit: String): String {
    val d = LocalDate.parse(date.take(10))
    return when (unit) {
        "day" -> d.plusDays(count.toLong())
        "week" -> d.plusWeeks(count.toLong())
        "year" -> d.plusYears(count.toLong())
        else -> d.plusMonths(count.toLong())
    }.toString()
}

/** A recurring cost and every date it falls due before payday. */
data class UpcomingCost(val cost: RecurringCost, val dates: List<String>, val total: Double)

/** Active costs due on or before [before], each counted every time it comes round (a weekly 600 four times is 2,400). */
fun upcomingCostsBefore(costs: List<RecurringCost>, before: LocalDate?): List<UpcomingCost> {
    if (before == null) return emptyList()
    val last = before.toString()
    return costs.filter { it.active && it.nextDueDate <= last }.map { cost ->
        val (count, unit) = recurringInterval(cost)
        val dates = mutableListOf<String>()
        var date = cost.nextDueDate.take(10)
        while (date <= last && dates.size < 400) {
            dates += date
            date = advanceDate(date, count, unit)
        }
        UpcomingCost(cost, dates, abs(cost.amount) * dates.size)
    }.sortedBy { it.cost.nextDueDate }
}

data class BeforePayday(val liquid: Double, val committed: Double, val buffer: Double, val available: Double, val upcoming: List<UpcomingCost>)

fun availableBeforePayday(
    accounts: List<Account>,
    transactions: List<Transaction>,
    costs: List<RecurringCost>,
    payday: LocalDate?,
    safetyBuffer: Double?,
    pockets: List<AccountPocket> = emptyList(),
): BeforePayday {
    val liquid = liquidBalance(accounts, transactions, pockets)
    val upcoming = upcomingCostsBefore(costs, payday)
    val committed = upcoming.sumOf { it.total }
    val buffer = safetyBuffer ?: 0.0
    return BeforePayday(liquid, committed, buffer, liquid - committed - buffer, upcoming)
}

/** Kept for screens that only need the plain figure. */
fun leftToSpend(accounts: List<Account>, transactions: List<Transaction>): Double = liquidBalance(accounts, transactions)

/* -------------------------- the Money overview -------------------------- */

private val DAYS_PER_UNIT = mapOf("day" to 1.0, "week" to 7.0, "month" to 365.25 / 12, "year" to 365.25)

/** A cost's size per month (its amount spread over its own interval); 0 when paused. */
fun monthlyEquivalent(cost: RecurringCost): Double {
    if (!cost.active) return 0.0
    val (count, unit) = recurringInterval(cost)
    val days = (DAYS_PER_UNIT[unit] ?: 30.4375) * count
    return if (days > 0) (cost.amount * (365.25 / 12)) / days else 0.0
}

/** The web's legacy frequency for an interval, kept in step when a date rolls on. */
fun legacyFrequency(unit: String, count: Int): String = when {
    count == 1 && unit == "day" -> "daily"
    count == 1 && unit == "week" -> "weekly"
    count == 1 && unit == "month" -> "monthly"
    count == 1 && unit == "year" -> "yearly"
    else -> "custom"
}

fun pocketBalance(pocket: AccountPocket, transactions: List<Transaction>): Double =
    pocket.openingBalance + transactions.filter { it.pocketId == pocket.id }.sumOf { it.amount }

/** How far through the payday cycle today is: days since the last payday, of the days between paydays. */
data class PaydayCycle(val start: LocalDate, val end: LocalDate, val elapsed: Long, val total: Long)

fun paydayCycle(config: PaydayConfig?, today: LocalDate = LocalDate.now()): PaydayCycle? {
    if (config == null || !hasPaydaySetup(config)) return null
    // Strictly after today, so a payday that is today opens a new cycle.
    val end = nextPayday(config, today.plusDays(1)) ?: return null
    val start = if (config.schedule == "monthly") previousPayday(config, today) else (config.intervalWeeks ?: 0).takeIf { it > 0 }?.let { end.minusWeeks(it.toLong()) }
    if (start == null || start.isAfter(today)) return null
    val total = ChronoUnit.DAYS.between(start, end)
    if (total <= 0) return null
    return PaydayCycle(start, end, ChronoUnit.DAYS.between(start, today), total)
}

/** Money out per week (from Monday) by category: the five largest kept, the rest as "Other". */
data class WeeklySpend(val weeks: List<LocalDate>, val series: List<Pair<String, String>>, val values: List<Map<String, Double>>)

fun weeklySpendByCategory(transactions: List<Transaction>, categories: List<app.lifeos.kt.core.model.FinanceCategory>, today: LocalDate, count: Int = 8, top: Int = 5): WeeklySpend {
    val current = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
    val weeks = (0 until count).map { current.minusWeeks((count - 1 - it).toLong()) }
    val inWindow = weeks.toSet()
    val names = categories.associate { it.id to it.name }
    val byWeek = mutableMapOf<LocalDate, MutableMap<String, Double>>()
    val totals = mutableMapOf<String, Double>()
    val labels = mutableMapOf<String, String>()
    for (t in transactions.filter { it.kind == "expense" }) {
        val week = runCatching { LocalDate.parse(t.date.take(10)) }.getOrNull()?.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)) ?: continue
        if (week !in inWindow) continue
        val key = t.categoryId ?: "uncategorised"
        labels[key] = t.categoryId?.let { names[it] ?: "Removed category" } ?: "Uncategorised"
        byWeek.getOrPut(week) { mutableMapOf() }.merge(key, abs(t.amount), Double::plus)
        totals.merge(key, abs(t.amount), Double::plus)
    }
    val ranked = totals.entries.sortedByDescending { it.value }
    val kept = ranked.take(top).map { it.key }.toSet()
    val series = ranked.take(top).map { it.key to labels.getValue(it.key) } + if (ranked.size > top) listOf("other" to "Other") else emptyList()
    val values = weeks.map { w -> (byWeek[w] ?: emptyMap<String, Double>()).entries.groupBy({ if (it.key in kept) it.key else "other" }, { it.value }).mapValues { it.value.sum() } }
    // Drop leading weeks with nothing, so a new person doesn't see a row of empty bars.
    val first = values.indexOfFirst { it.isNotEmpty() }
    return if (first == -1) WeeklySpend(emptyList(), series, emptyList()) else WeeklySpend(weeks.drop(first), series, values.drop(first))
}

/** The web's starter labels: names only, no amounts. */
val STARTER_CATEGORIES = listOf("Groceries" to "expense", "Rent" to "expense", "Transport" to "expense", "Eating out" to "expense", "Utilities" to "expense", "Subscriptions" to "expense", "Health" to "expense", "Salary" to "income")
