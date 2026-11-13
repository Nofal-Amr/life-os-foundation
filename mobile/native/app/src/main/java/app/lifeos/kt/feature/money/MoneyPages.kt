package app.lifeos.kt.feature.money

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.EventRepeat
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.IdentityPicker
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.SwipeAction
import app.lifeos.kt.core.designsystem.SwipeActions
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.AccountPocket
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.data.logic.legacyFrequency
import app.lifeos.kt.data.logic.recurringInterval
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.tasks.EditorSheet
import kotlin.math.abs

/* ------------------------------- Accounts ------------------------------- */

internal fun LazyListScope.accountsPage(s: MoneyState, model: MoneyViewModel) = item(key = "accounts") { AccountsPage(s, model) }

@Composable
private fun AccountsPage(s: MoneyState, model: MoneyViewModel) {
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.accounts.isEmpty()) {
            EmptyState(Icons.Outlined.AccountBalance, "Add an account", "An account holds your money. Add it with its opening balance, and every balance after that is worked out from what you log.")
        } else {
            // The figure that matters first: what counts toward left to spend, then what's kept apart.
            val counted = s.activeAccounts.filter { it.countsTowardSpendable && it.type != "credit" }.sumOf { s.balances[it.id] ?: 0.0 }
            LifeCard {
                Row {
                    Column(Modifier.weight(1f)) {
                        Eyebrow("Counts toward left to spend")
                        Text(s.money.format(counted), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                    }
                    if (s.separate.isNotEmpty()) {
                        Column(horizontalAlignment = Alignment.End) {
                            Eyebrow("Kept separate")
                            Text(s.money.format(s.separate.sumOf { it.second }), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                        }
                    }
                }
            }
            for (account in s.accounts) {
                LifeCard(onClick = { editing = account.id }, contentPadding = PaddingValues(vertical = 4.dp)) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        AccountIcon(account)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(account.name, style = MaterialTheme.typography.titleMedium, color = if (account.active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                            accountNote(account)?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
                        }
                        Text(s.money.format(s.balances[account.id] ?: 0.0), style = MaterialTheme.typography.titleMedium.merge(Numbers))
                    }
                    val pockets = s.pocketsOf(account.id)
                    if (pockets.isNotEmpty()) {
                        HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                        for (pocket in pockets) {
                            Row(Modifier.fillMaxWidth().padding(start = 62.dp, end = 16.dp, top = 8.dp, bottom = 8.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text(pocket.name, style = MaterialTheme.typography.bodyMedium)
                                    Muted(POCKET_KINDS.firstOrNull { it.first == pocket.kind }?.second ?: pocket.kind, style = MaterialTheme.typography.bodySmall)
                                }
                                Text(s.money.format(s.pocketBalances[pocket.id] ?: 0.0), style = MaterialTheme.typography.bodyMedium.merge(Numbers))
                            }
                        }
                    }
                }
            }
        }
    }
    s.accounts.firstOrNull { it.id == editing }?.let { AccountEditor(s, model, it, close = { editing = null }) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun AccountEditor(s: MoneyState, model: MoneyViewModel, account: Account?, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = account?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(account?.name.orEmpty()) }
    var type by rememberSaveable(key) { mutableStateOf(account?.type ?: "checking") }
    var opening by rememberSaveable(key) { mutableStateOf(account?.let { plainAmount(it.openingBalance) } ?: "") }
    var counts by rememberSaveable(key) { mutableStateOf(account?.countsTowardSpendable ?: true) }
    var active by rememberSaveable(key) { mutableStateOf(account?.active ?: true) }
    var icon by rememberSaveable(key) { mutableStateOf(account?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(account?.color) }
    var pocketName by rememberSaveable(key) { mutableStateOf("") }
    var pocketKind by rememberSaveable(key) { mutableStateOf("cash") }
    var pocketOpening by rememberSaveable(key) { mutableStateOf("") }
    val logged = account != null && s.transactions.any { it.accountId == account.id }

    EditorSheet(
        title = if (account == null) "New account" else "Edit account",
        close = close,
        onSave = {
            val balance = if (opening.isBlank()) 0.0 else parseAmount(opening)
            if (name.isBlank() || balance == null) { haptics.reject(); false } else {
                haptics.confirm()
                model.save((account ?: Account(newId(), name)).copy(name = name.trim(), type = type, openingBalance = balance, countsTowardSpendable = counts, active = active, icon = icon, color = color, currency = account?.currency ?: s.accounts.firstNotNullOfOrNull { it.currency }))
                true
            }
        },
        delete = account?.let { a -> { haptics.confirm(); model.delete(a); close(); undo("Account deleted") { model.save(a) } } },
        deleteNote = if (logged) "Its transactions stay, but no balance will count them." else null,
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Eyebrow("Type")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((value, label) in ACCOUNT_TYPES) SelectChip(type == value, label, { type = value })
        }
        NumberField(opening, { opening = it }, "Opening balance")
        Muted("What was in it when you started logging. Every balance after this is worked out.", style = MaterialTheme.typography.bodySmall)
        if (type != "credit") ToggleRow("Counts toward left to spend", if (counts) "Included in the figure on Overview." else "Kept separate, e.g. a home fund.", counts) { counts = it }
        ToggleRow("Active", if (active) "Shown everywhere." else "Hidden from choices; its history stays.", active) { active = it }
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
        if (account != null) {
            Eyebrow("Pockets")
            val pockets = s.pocketsOf(account.id)
            if (pockets.isEmpty()) Muted("No pockets yet.", style = MaterialTheme.typography.bodySmall)
            for (pocket in pockets) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(pocket.name, style = MaterialTheme.typography.bodyLarge)
                        Muted("${POCKET_KINDS.firstOrNull { it.first == pocket.kind }?.second ?: pocket.kind} · ${s.money.format(s.pocketBalances[pocket.id] ?: 0.0)}", style = MaterialTheme.typography.bodySmall)
                    }
                    IconButton(onClick = { haptics.confirm(); model.delete(pocket); undo("Pocket removed") { model.save(pocket) } }) {
                        Icon(Icons.Outlined.Delete, "Remove pocket", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }
            OutlinedTextField(pocketName, { pocketName = it }, label = { Text("Pocket name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for ((value, label) in POCKET_KINDS) SelectChip(pocketKind == value, label, { pocketKind = value })
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                NumberField(pocketOpening, { pocketOpening = it }, "Pocket opening balance", modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = {
                    val amount = if (pocketOpening.isBlank()) 0.0 else parseAmount(pocketOpening)
                    if (pocketName.isBlank() || amount == null) haptics.reject() else {
                        haptics.confirm()
                        model.save(AccountPocket(newId(), account.id, pocketName.trim(), pocketKind, amount))
                        pocketName = ""; pocketOpening = ""
                    }
                }) { Text("Add") }
            }
        }
    }
}

@Composable
private fun ToggleRow(title: String, detail: String, checked: Boolean, set: (Boolean) -> Unit) {
    val haptics = rememberHaptics()
    Row(
        Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).clickable(role = Role.Switch) { haptics.tick(); set(!checked) }.padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Muted(detail, style = MaterialTheme.typography.bodySmall)
        }
        Switch(checked, onCheckedChange = null)
    }
}

/* ----------------------------- Transactions ----------------------------- */

internal fun LazyListScope.transactionsPage(s: MoneyState, model: MoneyViewModel) {
    item(key = "tx-filters") { TransactionFilters(s) }
    val list = s.transactions.filter { t ->
        (TxFilter.account == null || t.accountId == TxFilter.account) &&
            (TxFilter.category == null || (if (TxFilter.category == "none") t.categoryId == null else t.categoryId == TxFilter.category)) &&
            (TxFilter.direction == null || t.kind == TxFilter.direction)
    }
    if (s.transactions.isEmpty()) {
        item(key = "tx-empty") { EmptyState(Icons.Outlined.ReceiptLong, "Nothing logged yet", "Every balance in Life OS is worked out from the money you log here, in or out.") }
        return
    }
    if (list.isEmpty()) {
        item(key = "tx-none") { Muted("Nothing matches these filters.", modifier = Modifier.padding(8.dp)) }
        return
    }
    for ((date, day) in list.groupBy { it.date.take(10) }) {
        item(key = "day-$date") {
            val out = day.filter { it.kind == "expense" }.sumOf { abs(it.amount) }
            val inn = day.filter { it.kind == "income" }.sumOf { abs(it.amount) }
            Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = 12.dp, bottom = 2.dp)) {
                Text(friendlyDate(date) ?: date, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                Muted(listOfNotNull(inn.takeIf { it > 0 }?.let { "+" + s.money.format(it) }, out.takeIf { it > 0 }?.let { s.money.format(-(it)) }).joinToString("  "), style = MaterialTheme.typography.bodySmall.merge(Numbers))
            }
        }
        items(day, key = { it.id }) { t -> TransactionRow(s, model, t, Modifier.animateItem()) }
    }
}

/** The filters live outside any one list item, so the list below can read them; they last for the session. */
private object TxFilter {
    var account by mutableStateOf<String?>(null)
    var category by mutableStateOf<String?>(null)
    var direction by mutableStateOf<String?>(null)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TransactionFilters(s: MoneyState) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectChip(TxFilter.direction == null, "All", { TxFilter.direction = null })
            SelectChip(TxFilter.direction == "expense", "Money out", { TxFilter.direction = if (TxFilter.direction == "expense") null else "expense" })
            SelectChip(TxFilter.direction == "income", "Money in", { TxFilter.direction = if (TxFilter.direction == "income") null else "income" })
        }
        if (s.accounts.size > 1) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip(TxFilter.account == null, "All accounts", { TxFilter.account = null })
                for (a in s.accounts) SelectChip(TxFilter.account == a.id, a.name, { TxFilter.account = if (TxFilter.account == a.id) null else a.id })
            }
        }
        if (s.categories.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip(TxFilter.category == null, "All categories", { TxFilter.category = null })
                for (c in s.categories.filter { TxFilter.direction == null || it.kind == TxFilter.direction }) SelectChip(TxFilter.category == c.id, c.name, { TxFilter.category = if (TxFilter.category == c.id) null else c.id })
                SelectChip(TxFilter.category == "none", "No category", { TxFilter.category = if (TxFilter.category == "none") null else "none" })
            }
        }
    }
}

@Composable
private fun TransactionRow(s: MoneyState, model: MoneyViewModel, t: Transaction, modifier: Modifier) {
    val undo = rememberUndo()
    var editing by rememberSaveable { mutableStateOf(false) }
    val income = t.amount > 0
    SwipeActions(
        start = null,
        end = SwipeAction("Delete", Icons.Outlined.Delete, MaterialTheme.colorScheme.error) {
            model.delete(t)
            undo("Transaction deleted") { model.save(t) }
        },
        modifier = modifier,
    ) {
        LifeCard(onClick = { editing = true }, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(if (income) Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward, tint = if (income) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, size = 34.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(t.description ?: s.categoryNames[t.categoryId] ?: if (income) "Money in" else "Money out", style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Muted(
                        listOfNotNull(
                            t.occurredTime?.take(5),
                            s.categoryNames[t.categoryId]?.takeIf { t.description != null },
                            s.accountNames[t.accountId],
                            s.pockets.firstOrNull { it.id == t.pocketId }?.name,
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
    if (editing && s.defaultAccountId != null) TransactionSheet(s, model, t, t.kind, close = { editing = false })
}

/* ------------------------------- Recurring ------------------------------- */

internal fun LazyListScope.recurringPage(s: MoneyState, model: MoneyViewModel) = item(key = "recurring") { RecurringPage(s, model) }

@Composable
private fun RecurringPage(s: MoneyState, model: MoneyViewModel) {
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.recurring.isEmpty()) {
            EmptyState(Icons.Outlined.EventRepeat, "Nothing logged yet", "Recurring costs are the bills you know are coming. They stay projections until you log one, so they never move a balance on their own.")
        } else {
            LifeCard {
                Eyebrow("About a month")
                Text(s.money.format(s.monthlyRecurring), style = MaterialTheme.typography.titleLarge.merge(Numbers))
                Muted("Projections only. Nothing changes a balance until you log it.", style = MaterialTheme.typography.bodySmall)
            }
            val (active, paused) = s.recurring.partition { it.active }
            if (active.isNotEmpty()) {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    active.forEachIndexed { index, cost ->
                        if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                        CostRow(s, model, cost, compact = false, onClick = { editing = cost.id })
                    }
                }
            }
            if (paused.isNotEmpty()) {
                SectionHeader("Paused")
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    paused.forEachIndexed { index, cost ->
                        if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                        CostRow(s, model, cost, compact = false, onClick = { editing = cost.id })
                    }
                }
            }
        }
    }
    s.recurring.firstOrNull { it.id == editing }?.let { CostEditor(s, model, it, close = { editing = null }) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CostEditor(s: MoneyState, model: MoneyViewModel, cost: RecurringCost?, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = cost?.id ?: "new"
    val interval = cost?.let(::recurringInterval) ?: (1 to "month")
    var name by rememberSaveable(key) { mutableStateOf(cost?.name.orEmpty()) }
    var amount by rememberSaveable(key) { mutableStateOf(cost?.let { plainAmount(abs(it.amount)) } ?: "") }
    var count by rememberSaveable(key) { mutableStateOf(interval.first.toString()) }
    var unit by rememberSaveable(key) { mutableStateOf(interval.second) }
    var due by rememberSaveable(key) { mutableStateOf<String?>(cost?.nextDueDate?.take(10) ?: s.today.toString()) }
    var accountId by rememberSaveable(key) { mutableStateOf(cost?.accountId ?: s.defaultAccountId) }
    var categoryId by rememberSaveable(key) { mutableStateOf(cost?.categoryId) }
    var active by rememberSaveable(key) { mutableStateOf(cost?.active ?: true) }
    var newCategory by rememberSaveable(key) { mutableStateOf<String?>(null) }

    EditorSheet(
        title = if (cost == null) "New recurring cost" else "Edit recurring cost",
        close = close,
        onSave = {
            val value = parseAmount(amount)
            val every = count.toIntOrNull()?.coerceAtLeast(1)
            if (name.isBlank() || value == null || value <= 0 || every == null || due == null) { haptics.reject(); false } else {
                haptics.confirm()
                model.save(
                    (cost ?: RecurringCost(newId(), name, 0.0, nextDueDate = due!!)).copy(
                        name = name.trim(),
                        amount = -abs(value),
                        intervalCount = every,
                        intervalUnit = unit,
                        frequency = legacyFrequency(unit, every),
                        nextDueDate = due!!,
                        nextDueAt = "${due}T00:00:00",
                        accountId = accountId,
                        categoryId = categoryId,
                        active = active,
                    ),
                )
                true
            }
        },
        delete = cost?.let { c -> { haptics.confirm(); model.delete(c); close(); undo("Cost deleted") { model.save(c) } } },
        deleteNote = "Transactions you already logged from it stay as they are.",
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        NumberField(amount, { amount = it.replace("-", "") }, "Amount")
        Eyebrow("Repeat")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Every", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.width(10.dp))
            NumberField(count, { count = it.filter(Char::isDigit).take(3) }, "", decimal = false, modifier = Modifier.width(76.dp))
        }
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            val units = listOf("day" to "Day", "week" to "Week", "month" to "Month", "year" to "Year")
            units.forEachIndexed { index, (v, label) ->
                SegmentedButton(selected = unit == v, onClick = { haptics.tick(); unit = v }, shape = SegmentedButtonDefaults.itemShape(index, units.size)) {
                    Text(if ((count.toIntOrNull() ?: 1) > 1) label + "s" else label)
                }
            }
        }
        Eyebrow("Next due")
        DateChoice(due, { due = it }, allowNone = false)
        if (s.activeAccounts.isNotEmpty()) {
            Eyebrow("Account")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (a in s.activeAccounts) SelectChip(accountId == a.id, a.name, { accountId = a.id })
            }
        } else {
            Muted("No account yet", style = MaterialTheme.typography.bodySmall)
        }
        Eyebrow("Category")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SelectChip(categoryId == null, "No category", { categoryId = null })
            for (c in s.categories.filter { it.kind == "expense" }) SelectChip(categoryId == c.id, c.name, { categoryId = c.id })
            if (newCategory == null) SelectChip(false, "New", { newCategory = "" }, leadingIcon = Icons.Outlined.Category)
        }
        newCategory?.let { n ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(n, { newCategory = it }, label = { Text("New category name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
                TextButton(onClick = { if (n.isBlank()) haptics.reject() else { haptics.confirm(); categoryId = model.createCategory(n, "expense"); newCategory = null } }) { Text("Add") }
            }
        }
        ToggleRow("Active", if (active) "Counted before payday." else "Paused: not counted anywhere.", active) { active = it }
    }
}

/* ------------------------------- Categories ------------------------------- */

internal fun LazyListScope.categoriesPage(s: MoneyState, model: MoneyViewModel) = item(key = "categories") { CategoriesPage(s, model) }

@Composable
private fun CategoriesPage(s: MoneyState, model: MoneyViewModel) {
    val haptics = rememberHaptics()
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (s.categories.isEmpty()) {
            EmptyState(Icons.Outlined.Category, "Nothing logged yet", "Your own labels for where money goes and comes from.") {
                Button(onClick = { haptics.confirm(); model.addStarters(s.categories) }, shape = MaterialTheme.shapes.medium) { Text("Add starter categories") }
            }
        }
        for ((kind, title) in listOf("expense" to "Money out", "income" to "Money in")) {
            val list = s.categories.filter { it.kind == kind }
            if (list.isEmpty()) continue
            SectionHeader(title)
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                list.forEachIndexed { index, c ->
                    if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    val spent = s.spentByCategoryThisMonth[c.id] ?: 0.0
                    Column(Modifier.fillMaxWidth().clickable { haptics.tick(); editing = c.id }.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            app.lifeos.kt.core.designsystem.EntityIcon(c.icon, c.color, fallback = Icons.Outlined.Category, size = 30.dp)
                            Spacer(Modifier.width(12.dp))
                            Text(c.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            if (kind == "expense" && (spent > 0 || c.monthlyBudget != null)) {
                                Text(
                                    s.money.format(spent) + (c.monthlyBudget?.let { " of " + s.money.format(it) } ?: ""),
                                    style = MaterialTheme.typography.bodyMedium.merge(Numbers),
                                    color = if (c.monthlyBudget != null && spent > c.monthlyBudget) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        c.monthlyBudget?.takeIf { it > 0 && kind == "expense" }?.let { budget ->
                            Spacer(Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { (spent / budget).toFloat().coerceIn(0f, 1f) },
                                modifier = Modifier.fillMaxWidth().padding(start = 42.dp),
                                color = if (spent > budget) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                                drawStopIndicator = {},
                            )
                        }
                    }
                }
            }
        }
        if (s.categories.any { it.monthlyBudget != null }) Muted("Spent this month, against the monthly budget you set.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 4.dp))
    }
    s.categories.firstOrNull { it.id == editing }?.let { CategoryEditor(model, it, close = { editing = null }) }
}

@Composable
internal fun CategoryEditor(model: MoneyViewModel, category: FinanceCategory?, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = category?.id ?: "new"
    var name by rememberSaveable(key) { mutableStateOf(category?.name.orEmpty()) }
    var kind by rememberSaveable(key) { mutableStateOf(category?.kind ?: "expense") }
    var budget by rememberSaveable(key) { mutableStateOf(category?.monthlyBudget?.let(::plainAmount) ?: "") }
    var icon by rememberSaveable(key) { mutableStateOf(category?.icon) }
    var color by rememberSaveable(key) { mutableStateOf(category?.color) }
    EditorSheet(
        title = if (category == null) "New category" else "Edit category",
        close = close,
        onSave = {
            val limit = if (budget.isBlank()) null else parseAmount(budget)
            if (name.isBlank() || (budget.isNotBlank() && limit == null)) { haptics.reject(); false } else {
                haptics.confirm()
                model.save((category ?: FinanceCategory(newId(), name)).copy(name = name.trim(), kind = kind, monthlyBudget = if (kind == "expense") limit else null, icon = icon, color = color))
                true
            }
        },
        delete = category?.let { c -> { haptics.confirm(); model.delete(c); close(); undo("Category deleted") { model.save(c) } } },
        deleteNote = "Transactions in it stay, with no category.",
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("expense" to "Expense", "income" to "Income").forEachIndexed { index, (v, label) ->
                SegmentedButton(selected = kind == v, onClick = { haptics.tick(); kind = v }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text(label) }
            }
        }
        if (kind == "expense") NumberField(budget, { budget = it.replace("-", "") }, "Monthly budget (optional)")
        IdentityPicker(icon, color) { i, c -> icon = i; color = c }
    }
}
