package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.Transaction
import kotlin.math.abs

// The web app's rules (src/data/finance.ts): amounts are signed (expenses
// negative), a balance is the opening balance plus everything moved.

fun accountBalance(account: Account, transactions: List<Transaction>): Double =
    account.openingBalance + transactions.filter { it.accountId == account.id }.sumOf { it.amount }

/** Money in active accounts that count toward spending (a home fund can be left out). */
fun leftToSpend(accounts: List<Account>, transactions: List<Transaction>): Double = accounts
    .filter { it.active && it.countsTowardSpendable }
    .sumOf { accountBalance(it, transactions) }

/** Spent on dates starting with [prefix]: a day (2026-10-23) or a month (2026-10). */
fun spentDuring(transactions: List<Transaction>, prefix: String): Double = transactions
    .filter { it.kind == "expense" && it.date.startsWith(prefix) }
    .sumOf { abs(it.amount) }

/** The stored amount for a kind: expenses negative, as the web app saves them. */
fun signedAmount(magnitude: Double, kind: String): Double = if (kind == "expense") -abs(magnitude) else abs(magnitude)
