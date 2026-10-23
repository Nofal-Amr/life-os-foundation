package app.lifeos.kt.feature.money

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.AnimatedNumber
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.logic.accountBalance
import app.lifeos.kt.data.logic.leftToSpend
import app.lifeos.kt.data.logic.signedAmount
import app.lifeos.kt.data.logic.spentDuring
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class MoneyState(
    val money: MoneyFormatter,
    val left: Double,
    val spentToday: Double,
    val spentMonth: Double,
    val accounts: List<Pair<Account, Double>>,
    val recent: List<Transaction>,
    val categories: List<FinanceCategory>,
    val accountNames: Map<String, String>,
    val categoryNames: Map<String, String>,
)

@HiltViewModel
class MoneyViewModel @Inject constructor(private val repo: MoneyRepository, prefs: PreferencesRepository) : ViewModel() {
    val state: StateFlow<MoneyState?> = combine(repo.accounts, repo.transactions, repo.categories, prefs.preferences) { accounts, transactions, categories, p ->
        val today = LocalDate.now().toString()
        MoneyState(
            money = MoneyFormatter(p?.currency),
            left = leftToSpend(accounts, transactions),
            spentToday = spentDuring(transactions, today),
            spentMonth = spentDuring(transactions, today.take(7)),
            accounts = accounts.filter { it.active }.sortedBy { it.name.lowercase() }.map { it to accountBalance(it, transactions) },
            recent = transactions.sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.occurredTime ?: "" }).take(60),
            categories = categories.sortedBy { it.name.lowercase() },
            accountNames = accounts.associate { it.id to it.name },
            categoryNames = categories.associate { it.id to it.name },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(transaction: Transaction) = viewModelScope.launch { repo.save(transaction) }
    fun delete(transaction: Transaction) = viewModelScope.launch { repo.delete(transaction) }

    fun add(kind: String, amount: Double, accountId: String, categoryId: String?, description: String) = viewModelScope.launch {
        repo.save(
            Transaction(
                id = newId(),
                accountId = accountId,
                amount = signedAmount(amount, kind),
                kind = kind,
                categoryId = categoryId,
                date = LocalDate.now().toString(),
                occurredTime = LocalTime.now().withNano(0).format(DateTimeFormatter.ISO_LOCAL_TIME),
                description = description.trim().ifEmpty { null },
            ),
        )
    }
}

@Composable
fun MoneyScreen(model: MoneyViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val undo = rememberUndo()
    var adding by rememberSaveable { mutableStateOf(false) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }

    LifePage(
        title = "Money",
        actions = { SyncAction() },
        refreshing = sync.state.running,
        onRefresh = sync.syncNow,
        floatingActionButton = {
            if (state?.accounts?.isNotEmpty() == true) {
                ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text("Spend") })
            }
        },
    ) {
        val s = state
        if (s == null) {
            items(3) { Skeleton(height = 96.dp) }
            return@LifePage
        }
        item {
            LifeCard(color = MaterialTheme.colorScheme.primaryContainer) {
                Eyebrow("Left to spend", color = MaterialTheme.colorScheme.onPrimaryContainer)
                AnimatedNumber(s.left, s.money::format, MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    Column {
                        Eyebrow("Spent today", color = MaterialTheme.colorScheme.onPrimaryContainer)
                        AnimatedNumber(s.spentToday, s.money::short, MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                    Column {
                        Eyebrow("This month", color = MaterialTheme.colorScheme.onPrimaryContainer)
                        AnimatedNumber(s.spentMonth, s.money::short, MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
            }
        }
        if (s.accounts.isEmpty()) {
            item { EmptyState(Icons.Outlined.AccountBalance, "No accounts yet", "Add your accounts on the website for now; they appear here, offline too.") }
        } else {
            item { SectionHeader("Accounts") }
            item {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    for ((account, balance) in s.accounts) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconBadge(Icons.Outlined.AccountBalance, size = 34.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(account.name, style = MaterialTheme.typography.bodyLarge)
                                if (!account.countsTowardSpendable) Muted("Not in left to spend", style = MaterialTheme.typography.bodySmall)
                            }
                            Text(s.money.format(balance), style = MaterialTheme.typography.titleMedium.merge(Numbers))
                        }
                    }
                }
            }
        }
        item { SectionHeader(if (s.recent.isEmpty()) "No transactions yet" else "Recent") }
        if (s.recent.isEmpty()) {
            item {
                EmptyState(
                    Icons.Outlined.ReceiptLong,
                    "Nothing recorded",
                    if (s.accounts.isEmpty()) "Once you have an account, a Spend button appears here." else "Tap Spend to add one. It's saved on this phone first.",
                )
            }
        }
        items(s.recent, key = { it.id }) { t ->
            val income = t.amount > 0
            Row(
                Modifier.fillMaxWidth().animateItem().clip(MaterialTheme.shapes.medium).clickable { editingId = t.id }.padding(horizontal = 4.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconBadge(if (income) Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward, tint = if (income) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, size = 34.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        t.description ?: s.categoryNames[t.categoryId] ?: if (income) "Income" else "Expense",
                        style = MaterialTheme.typography.bodyLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Muted(
                        listOfNotNull(
                            friendlyDate(t.date),
                            s.categoryNames[t.categoryId]?.takeIf { t.description != null },
                            s.accountNames[t.accountId],
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                    )
                }
                Text(
                    (if (income) "+" else "") + s.money.format(t.amount),
                    style = MaterialTheme.typography.bodyLarge.merge(Numbers),
                    color = if (income) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }

    val s = state
    if (adding && s != null) AddTransactionSheet(s, close = { adding = false }, add = model::add)
    s?.recent?.firstOrNull { it.id == editingId }?.let { t ->
        EditTransactionSheet(
            s,
            t,
            close = { editingId = null },
            save = { model.save(it); editingId = null },
            delete = {
                model.delete(t)
                editingId = null
                undo("Deleted ${s.money.format(t.amount)}") { model.save(t) }
            },
        )
    }
}

/** Fix a wrong amount, note or category, or delete it. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun EditTransactionSheet(s: MoneyState, t: Transaction, close: () -> Unit, save: (Transaction) -> Unit, delete: () -> Unit) {
    val haptics = rememberHaptics()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var amount by rememberSaveable(t.id) { mutableStateOf(kotlin.math.abs(t.amount).let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }) }
    var description by rememberSaveable(t.id) { mutableStateOf(t.description.orEmpty()) }
    var categoryId by rememberSaveable(t.id) { mutableStateOf(t.categoryId) }
    var date by rememberSaveable(t.id) { mutableStateOf<String?>(t.date) }
    val value = amount.replace(",", ".").toDoubleOrNull()

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (t.kind == "income") "Income" else "Expense", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it },
                label = { Text("Amount") },
                singleLine = true,
                textStyle = MaterialTheme.typography.headlineSmall.merge(Numbers),
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("What for") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            Eyebrow("Date")
            DateChoice(date, { date = it }, allowNone = false)
            val forKind = s.categories.filter { it.kind == (if (t.kind == "income") "income" else "expense") }
            if (forKind.isNotEmpty()) {
                Eyebrow("Category")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (category in forKind) SelectChip(categoryId == category.id, category.name, { categoryId = if (categoryId == category.id) null else category.id })
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = delete) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        if (value == null || value <= 0) {
                            haptics.reject()
                        } else {
                            haptics.confirm()
                            save(t.copy(amount = signedAmount(value, t.kind), description = description.trim().ifEmpty { null }, categoryId = categoryId, date = date ?: t.date))
                        }
                    },
                    shape = MaterialTheme.shapes.medium,
                ) { Text("Save") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun AddTransactionSheet(s: MoneyState, close: () -> Unit, add: (String, Double, String, String?, String) -> Unit) {
    val haptics = rememberHaptics()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var kind by rememberSaveable { mutableStateOf("expense") }
    var amount by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var accountId by rememberSaveable { mutableStateOf(s.accounts.firstOrNull { it.first.countsTowardSpendable }?.first?.id ?: s.accounts.first().first.id) }
    var categoryId by rememberSaveable { mutableStateOf<String?>(null) }
    val value = amount.replace(',', '.').toDoubleOrNull()

    ModalBottomSheet(onDismissRequest = close, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding().imePadding().padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("expense" to "Expense", "income" to "Income").forEachIndexed { index, (value, label) ->
                    SegmentedButton(
                        selected = kind == value,
                        onClick = { haptics.tick(); kind = value; categoryId = null },
                        shape = SegmentedButtonDefaults.itemShape(index, 2),
                    ) { Text(label) }
                }
            }
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it },
                label = { Text("Amount") },
                singleLine = true,
                textStyle = MaterialTheme.typography.headlineSmall.merge(Numbers),
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("What for (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            Eyebrow("Account")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((account, _) in s.accounts) SelectChip(accountId == account.id, account.name, { accountId = account.id })
            }
            val forKind = s.categories.filter { it.kind == kind }
            if (forKind.isNotEmpty()) {
                Eyebrow("Category")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (category in forKind) SelectChip(categoryId == category.id, category.name, { categoryId = if (categoryId == category.id) null else category.id })
                }
            }
            Button(
                onClick = {
                    if (value == null || value <= 0) {
                        haptics.reject()
                    } else {
                        haptics.confirm()
                        add(kind, value, accountId, categoryId, description)
                        close()
                    }
                },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text(if (value != null && value > 0) "Save ${s.money.short(value)}" else "Save") }
        }
    }
}
