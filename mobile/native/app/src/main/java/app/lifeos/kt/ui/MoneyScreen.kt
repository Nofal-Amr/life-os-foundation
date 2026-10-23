package app.lifeos.kt.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.accountBalance
import app.lifeos.kt.data.leftToSpend
import app.lifeos.kt.data.signedAmount
import app.lifeos.kt.data.spentDuring
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun MoneyScreen() {
    val accounts = table("accounts")
    val transactions = table("transactions")
    val categories = table("finance_categories").orEmpty()
    val money = moneyFormat()
    val today = LocalDate.now()
    var adding by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            PageHeader("Money")
            if (accounts != null && transactions != null) {
                val active = accounts.filter { it.optBoolean("active", true) }.sortedBy { it.optString("name") }
                val recent = transactions.sortedWith(
                    compareByDescending<JSONObject> { it.optString("date") }.thenByDescending { it.text("occurred_time") ?: "" },
                ).take(50)
                val categoryNames = categories.associate { it.optString("id") to it.optString("name") }
                val accountNames = accounts.associate { it.optString("id") to it.optString("name") }

                LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 96.dp)) {
                    item {
                        Panel {
                            Muted("Left to spend")
                            Text(money(leftToSpend(accounts, transactions)), style = MaterialTheme.typography.headlineMedium)
                            Spacer(Modifier.height(4.dp))
                            Muted(
                                "Spent today ${money(spentDuring(transactions, today.toString()))} · " +
                                    "this month ${money(spentDuring(transactions, today.toString().take(7)))}",
                            )
                        }
                    }
                    if (active.isNotEmpty()) item { SectionLabel("Accounts") }
                    items(active, key = { "a" + it.optString("id") }) { account ->
                        Panel {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(account.optString("name"), style = MaterialTheme.typography.bodyLarge)
                                    if (!account.optBoolean("counts_toward_spendable", true)) Muted("Not counted in left to spend")
                                }
                                Text(money(accountBalance(account, transactions)), style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                    item { SectionLabel(if (recent.isEmpty()) "No transactions yet" else "Recent") }
                    items(recent, key = { "t" + it.optString("id") }) { t ->
                        val amount = t.num("amount")
                        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    t.text("description") ?: categoryNames[t.optString("category_id")] ?: kindLabel(t.optString("kind")),
                                    style = MaterialTheme.typography.bodyLarge,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Muted(
                                    listOfNotNull(
                                        shortDate(t.optString("date"), today),
                                        categoryNames[t.optString("category_id")]?.takeIf { t.text("description") != null },
                                        accountNames[t.optString("account_id")],
                                    ).joinToString(" · "),
                                )
                            }
                            Text(
                                (if (amount > 0) "+" else "") + money(amount),
                                style = MaterialTheme.typography.bodyLarge,
                                color = if (amount > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
        }
        if (!accounts.isNullOrEmpty()) {
            FloatingActionButton(onClick = { adding = true }, modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp)) {
                Icon(Icons.Filled.Add, contentDescription = "Add a transaction")
            }
        }
    }

    if (adding && accounts != null) {
        AddTransaction(accounts.filter { it.optBoolean("active", true) }, categories, close = { adding = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun AddTransaction(accounts: List<JSONObject>, categories: List<JSONObject>, close: () -> Unit) {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    var kind by remember { mutableStateOf("expense") }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var accountId by remember { mutableStateOf(accounts.firstOrNull()?.optString("id")) }
    var categoryId by remember { mutableStateOf<String?>(null) }
    val value = amount.replace(',', '.').toDoubleOrNull()

    AlertDialog(
        onDismissRequest = close,
        title = { Text(if (kind == "expense") "Add an expense" else "Add income") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = kind == "expense", onClick = { kind = "expense"; categoryId = null }, label = { Text("Expense") })
                    FilterChip(selected = kind == "income", onClick = { kind = "income"; categoryId = null }, label = { Text("Income") })
                }
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("What for (optional)") }, singleLine = true)
                Muted("Account")
                androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (account in accounts) {
                        val id = account.optString("id")
                        FilterChip(selected = accountId == id, onClick = { accountId = id }, label = { Text(account.optString("name")) })
                    }
                }
                val forKind = categories.filter { it.optString("kind") == kind }.sortedBy { it.optString("name") }
                if (forKind.isNotEmpty()) {
                    Muted("Category")
                    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (category in forKind) {
                            val id = category.optString("id")
                            FilterChip(
                                selected = categoryId == id,
                                onClick = { categoryId = if (categoryId == id) null else id },
                                label = { Text(category.optString("name")) },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = value != null && value > 0 && accountId != null,
                onClick = {
                    val row = JSONObject()
                        .put("account_id", accountId)
                        .put("amount", signedAmount(value!!, kind))
                        .put("kind", kind)
                        .put("category_id", categoryId ?: JSONObject.NULL)
                        .put("description", description.trim().ifEmpty { null } ?: JSONObject.NULL)
                        .put("date", LocalDate.now().toString())
                        .put("occurred_time", LocalTime.now().withNano(0).format(DateTimeFormatter.ISO_LOCAL_TIME))
                    scope.launch { rows.save("transactions", row) }
                    close()
                },
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = close) { Text("Cancel") } },
    )
}

private fun kindLabel(kind: String) = when (kind) {
    "income" -> "Income"
    "adjustment" -> "Adjustment"
    else -> "Expense"
}

fun shortDate(iso: String, today: LocalDate): String {
    val date = runCatching { LocalDate.parse(iso) }.getOrNull() ?: return iso
    return when (date) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> date.format(DateTimeFormatter.ofPattern(if (date.year == today.year) "d MMM" else "d MMM yyyy"))
    }
}
