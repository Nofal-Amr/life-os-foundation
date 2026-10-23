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
