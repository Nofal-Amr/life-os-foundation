package app.lifeos.kt.data

import org.json.JSONObject

// The web app's rules (src/data/finance.ts): amounts are signed (expenses
// negative), a balance is the opening balance plus everything moved.

private fun JSONObject.amount(key: String) = if (isNull(key)) 0.0 else optDouble(key, 0.0)

fun accountBalance(account: JSONObject, transactions: List<JSONObject>): Double {
    val id = account.getString("id")
    return account.amount("opening_balance") +
        transactions.filter { it.optString("account_id") == id }.sumOf { it.amount("amount") }
}

/** Money in active accounts that count toward spending (a home fund can be left out). */
fun leftToSpend(accounts: List<JSONObject>, transactions: List<JSONObject>): Double = accounts
    .filter { it.optBoolean("active", true) && it.optBoolean("counts_toward_spendable", true) }
    .sumOf { accountBalance(it, transactions) }

/** Spent on dates starting with [prefix]: a day (2026-10-23) or a month (2026-10). */
fun spentDuring(transactions: List<JSONObject>, prefix: String): Double = transactions
    .filter { it.optString("kind") == "expense" && it.optString("date").startsWith(prefix) }
    .sumOf { Math.abs(it.amount("amount")) }

/** The stored amount for a kind: expenses negative, as the web app saves them. */
fun signedAmount(magnitude: Double, kind: String): Double =
    if (kind == "expense") -Math.abs(magnitude) else Math.abs(magnitude)
