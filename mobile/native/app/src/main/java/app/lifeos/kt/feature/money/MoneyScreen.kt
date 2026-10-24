package app.lifeos.kt.feature.money

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.designsystem.AnimatedNumber
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LocalStatusBarHandled
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.NotEnoughData
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.ProgressRing
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.StackedBarChart
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.PaydayConfig
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.data.logic.relativeDay
import app.lifeos.kt.data.logic.signedAmount
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.today.MoneyBreakdownSheet
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.abs
import kotlinx.coroutines.launch

private val PAGES = listOf(
    "Overview" to "What you actually have before your next payday.",
    "Accounts" to "Where your money is, with balances from what you log.",
    "Transactions" to "Everything you have logged, grouped by day.",
    "Recurring" to "Bills you know are coming. Projections until you log one.",
    "Categories" to "Your own labels for where money goes and comes from.",
)

/**
 * Money: the web's five pages as swipeable tabs. Every figure is worked out
 * from what was logged; nothing is invented, and a cost only moves a balance
 * once it's logged.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoneyScreen(model: MoneyViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val pager = rememberPagerState { PAGES.size }
    val focus = androidx.compose.ui.platform.LocalFocusManager.current
    val scope = rememberCoroutineScope()
    var adding by rememberSaveable { mutableStateOf<String?>(null) } // "expense", "income", "account", "cost", "category"
    var editingPayday by rememberSaveable { mutableStateOf(false) }
    var breakdown by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(pager) {
        var first = true
        snapshotFlow { pager.settledPage }.collect { 
            // A field left focused on one tab would keep the keyboard up on the next.
            focus.clearFocus()
            if (first) first = false else haptics.tick()
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            val top = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
            Row(top.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Money", style = MaterialTheme.typography.headlineLarge)
                    Muted(PAGES[pager.currentPage].second)
                }
                SyncAction()
            }
            PrimaryScrollableTabRow(selectedTabIndex = pager.currentPage, edgePadding = 12.dp, containerColor = MaterialTheme.colorScheme.background, divider = {}) {
                PAGES.forEachIndexed { index, (label, _) ->
                    Tab(
                        selected = pager.currentPage == index,
                        onClick = { scope.launch { pager.animateScrollToPage(index) } },
                        text = { Text(label, style = MaterialTheme.typography.labelLarge) },
                        selectedContentColor = MaterialTheme.colorScheme.primary,
                        unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1) { page ->
                val s = state
                MoneyList {
                    if (s == null) {
                        items(4) { Skeleton(height = 80.dp) }
                        return@MoneyList
                    }
                    when (page) {
                        0 -> overviewPage(
                            s, model,
                            add = { adding = it },
                            editPayday = { editingPayday = true },
                            showBreakdown = { breakdown = true },
                            goTo = { scope.launch { pager.animateScrollToPage(it) } },
                        )
                        1 -> accountsPage(s, model)
                        2 -> transactionsPage(s, model)
                        3 -> recurringPage(s, model)
                        else -> categoriesPage(s, model)
                    }
                }
            }
        }
        val s = state
        val fab = when (pager.currentPage) {
            0, 2 -> if (s?.defaultAccountId != null) "Spend" else null
            1 -> "Account"
            3 -> "Cost"
            else -> "Category"
        }
        if (fab != null) {
            ExtendedFloatingActionButton(
                onClick = {
                    haptics.tick()
                    adding = when (pager.currentPage) { 1 -> "account"; 3 -> "cost"; 4 -> "category"; else -> "expense" }
                },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text(fab) },
                modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
            )
        }
    }

    val s = state ?: return
    when (adding) {
        "expense", "income" -> if (s.defaultAccountId != null) TransactionSheet(s, model, null, adding!!, close = { adding = null })
        "account" -> AccountEditor(s, model, null, close = { adding = null })
        "cost" -> CostEditor(s, model, null, close = { adding = null })
        "category" -> CategoryEditor(model, null, close = { adding = null })
    }
    if (editingPayday) PaydaySheet(s, model, close = { editingPayday = false })
    if (breakdown && s.nextPayday != null) MoneyBreakdownSheet(s.totals, s.nextPayday, s.money, close = { breakdown = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoneyList(content: LazyListScope.() -> Unit) {
    val sync = LocalSyncStatus.current
    PullToRefreshBox(isRefreshing = sync.state.running, onRefresh = sync.syncNow, modifier = Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 112.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

/* ------------------------------- Overview ------------------------------- */

private fun LazyListScope.overviewPage(
    s: MoneyState,
    model: MoneyViewModel,
    add: (String) -> Unit,
    editPayday: () -> Unit,
    showBreakdown: () -> Unit,
    goTo: (Int) -> Unit,
) {
    item(key = "hero") { Hero(s, add, editPayday, showBreakdown, goTo) }
    if (s.moneyHabits.isNotEmpty()) item(key = "habits") { MoneyHabits(s, model) }
    if (s.activeAccounts.isNotEmpty()) {
        item(key = "glance-head") { SectionHeader("At a glance", action = "Manage", onAction = { goTo(1) }) }
        item(key = "glance") { AtAGlance(s, goTo) }
    }
    s.cycle?.let { cycle ->
        item(key = "cycle") {
            LifeCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(contentAlignment = Alignment.Center) {
                        ProgressRing(cycle.elapsed.toFloat() / cycle.total, size = 52.dp, stroke = 5.dp)
                        Text("${cycle.elapsed}", style = MaterialTheme.typography.titleSmall.merge(Numbers))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Eyebrow("Payday cycle")
                        Text("Day ${cycle.elapsed + 1} of ${cycle.total}", style = MaterialTheme.typography.titleMedium)
                        val fmt = DateTimeFormatter.ofPattern("d MMM")
                        Muted("${cycle.start.format(fmt)} to ${cycle.end.format(fmt)}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
    item(key = "weekly-head") { SectionHeader("Spending per week") }
    item(key = "weekly") {
        LifeCard {
            Muted("Money out, by category, over the last 8 weeks.", style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(10.dp))
            if (s.weekly.weeks.size < 2) {
                NotEnoughData("Log spending in at least two different weeks.")
            } else {
                val fmt = DateTimeFormatter.ofPattern("d MMM")
                StackedBarChart(
                    labels = s.weekly.weeks.map { it.format(fmt) },
                    series = s.weekly.series,
                    values = s.weekly.values,
                    format = s.money::format,
                )
            }
        }
    }
    item(key = "coming-head") { SectionHeader("Coming up", action = if (s.recurring.isNotEmpty()) "All" else null, onAction = { goTo(3) }) }
    val upcoming = s.recurring.filter { it.active }.take(5)
    if (upcoming.isEmpty()) {
        item(key = "coming-empty") { LifeCard { Muted("No recurring costs yet.") } }
    } else {
        item(key = "coming") {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                upcoming.forEachIndexed { index, cost ->
                    if (index > 0) HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    CostRow(s, model, cost, compact = true)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Hero(s: MoneyState, add: (String) -> Unit, editPayday: () -> Unit, showBreakdown: () -> Unit, goTo: (Int) -> Unit) {
    val onHero = MaterialTheme.colorScheme.onPrimaryContainer
    if (s.activeAccounts.isEmpty()) {
        LifeCard {
            IconBadge(Icons.Outlined.AccountBalance, size = 40.dp)
            Spacer(Modifier.height(10.dp))
            Text("Add an account", style = MaterialTheme.typography.titleLarge)
            Muted("An account holds your money. Add it with its opening balance, and every balance after that is worked out from what you log.")
            Spacer(Modifier.height(12.dp))
            Button(onClick = { goTo(1) }, shape = MaterialTheme.shapes.medium) { Text("Go to accounts") }
        }
        return
    }
    if (!s.setup) {
        LifeCard(color = MaterialTheme.colorScheme.primaryContainer) {
            Eyebrow("Balance now", color = onHero)
            AnimatedNumber(s.totals.liquid, s.money::format, MaterialTheme.typography.displaySmall, color = onHero)
            Spacer(Modifier.height(6.dp))
            Text("Set your payday and a safety buffer to see what's left to spend before then.", color = onHero, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(12.dp))
            Button(onClick = editPayday, shape = MaterialTheme.shapes.medium) { Icon(Icons.Outlined.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text("Set up payday") }
            Spacer(Modifier.height(8.dp))
            HeroActions(add, goTo)
        }
        return
    }
    val days = s.nextPayday?.let { java.time.temporal.ChronoUnit.DAYS.between(s.today, it) }
    val until = when (days) {
        null -> null
        0L -> "Payday is today"
        1L -> "1 day until payday"
        else -> "$days days until payday"
    }
    LifeCard(color = MaterialTheme.colorScheme.primaryContainer, onClick = showBreakdown) {
        Eyebrow("Left to spend before payday", color = onHero)
        AnimatedNumber(
            s.totals.available,
            s.money::format,
            MaterialTheme.typography.displayMedium,
            color = if (s.totals.available < 0) MaterialTheme.colorScheme.error else onHero,
        )
        Text(
            listOfNotNull(until, "After upcoming recurring costs and your safety buffer.").joinToString(" · "),
            color = onHero.copy(alpha = 0.8f),
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Spent today ", color = onHero.copy(alpha = 0.8f), style = MaterialTheme.typography.bodyMedium)
            AnimatedNumber(s.spentToday, s.money::format, MaterialTheme.typography.bodyMedium.merge(Numbers), color = onHero)
            if (s.todayCount > 0) Text(" · ${s.todayCount} ${if (s.todayCount == 1) "entry" else "entries"}", color = onHero.copy(alpha = 0.8f), style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(12.dp))
        HeroActions(add, goTo)
        Spacer(Modifier.height(14.dp))
        HorizontalDivider(color = onHero.copy(alpha = 0.15f))
        Spacer(Modifier.height(10.dp))
        val line = MaterialTheme.typography.bodyMedium
        HeroLine("Balance now", s.money.format(s.totals.liquid), onHero, line)
        HeroLine("Recurring costs before payday", s.money.format(-(s.totals.committed)), onHero, line)
        HeroLine("Safety buffer", s.money.format(-(s.totals.buffer)), onHero, line)
        s.nextPayday?.let { HeroLine("Next payday", it.format(DateTimeFormatter.ofPattern("EEE d MMM")), onHero, line) }
        if (s.totals.available < 0) {
            Spacer(Modifier.height(6.dp))
            Text("Upcoming costs are ${s.money.format(abs(s.totals.available))} more than you have.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        if (s.separate.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Kept separate, not in this figure: ${s.money.format(s.separate.sumOf { it.second })} in ${s.separate.joinToString(", ") { it.first.name }}.",
                color = onHero.copy(alpha = 0.8f),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(4.dp))
        TextButton(onClick = editPayday, contentPadding = PaddingValues(0.dp)) { Text("Edit pay and buffer", color = onHero) }
    }
}

@Composable
private fun HeroLine(label: String, value: String, color: androidx.compose.ui.graphics.Color, style: androidx.compose.ui.text.TextStyle) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, color = color.copy(alpha = 0.8f), style = style, modifier = Modifier.weight(1f))
        Text(value, color = color, style = style.merge(Numbers))
    }
}

@Composable
private fun HeroActions(add: (String) -> Unit, @Suppress("UNUSED_PARAMETER") goTo: (Int) -> Unit) {
    // Two equal actions; the Transactions tab is one swipe away, so no third button.
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(onClick = { add("expense") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f).height(48.dp)) { Text("Add spending") }
        Button(
            onClick = { add("income") },
            shape = MaterialTheme.shapes.medium,
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.primary),
            modifier = Modifier.weight(1f).height(48.dp),
        ) { Text("Add income") }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MoneyHabits(s: MoneyState, model: MoneyViewModel) {
    val haptics = rememberHaptics()
    val today = s.today.toString()
    LifeCard {
        Eyebrow("Money habits")
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (habit in s.moneyHabits) {
                val done = s.habitLogs.any { it.habitId == habit.id && it.logDate == today }
                SelectChip(done, habit.name, {
                    if (done) haptics.tick() else haptics.confirm()
                    model.toggleHabit(habit, s.habitLogs)
                })
            }
        }
    }
}

@Composable
private fun AtAGlance(s: MoneyState, goTo: (Int) -> Unit) {
    LifeCard(contentPadding = PaddingValues(vertical = 4.dp), onClick = { goTo(1) }) {
        for (account in s.activeAccounts) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                AccountIcon(account)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(account.name, style = MaterialTheme.typography.bodyLarge)
                    accountNote(account)?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
                }
                Text(s.money.format(s.balances[account.id] ?: 0.0), style = MaterialTheme.typography.titleMedium.merge(Numbers))
            }
        }
    }
}

/* -------------------------- recurring cost row -------------------------- */

/** A cost with its next date and Log / Skip. Logging asks which account only when there's a choice. */
@Composable
internal fun CostRow(s: MoneyState, model: MoneyViewModel, cost: RecurringCost, compact: Boolean, onClick: (() -> Unit)? = null) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var choosing by remember { mutableStateOf(false) }
    val late = cost.active && cost.nextDueDate.take(10) < s.today.toString()
    val accountId = cost.accountId?.takeIf { id -> s.activeAccounts.any { it.id == id } }
    fun log(id: String) {
        haptics.confirm()
        model.log(cost, id) { revert -> undo("Logged ${s.money.format(abs(cost.amount))} · ${cost.name}") { revert() } }
    }
    Column(Modifier.fillMaxWidth().animateContentSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(cost.name, style = MaterialTheme.typography.bodyLarge)
                Muted(
                    listOfNotNull(
                        if (late) "Past its date" else relativeDay(cost.nextDueDate, s.today),
                        repeatLabel(cost).takeIf { !compact },
                        s.accountNames[cost.accountId].takeIf { !compact },
                        "Paused".takeIf { !cost.active },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(s.money.format(abs(cost.amount)), style = MaterialTheme.typography.titleMedium.merge(Numbers))
        }
        if (cost.active) {
            Row(Modifier.padding(start = 4.dp, bottom = 2.dp).height(40.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = {
                    when {
                        accountId != null -> log(accountId)
                        s.activeAccounts.size == 1 -> log(s.activeAccounts.first().id)
                        s.activeAccounts.isEmpty() -> haptics.reject()
                        else -> { haptics.tick(); choosing = !choosing }
                    }
                }) { Text("Log it") }
                TextButton(onClick = { haptics.tick(); model.skip(cost); undo("Skipped. Nothing was logged.") { model.save(cost) } }) { Text("Skip") }
                if (onClick != null) {
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = onClick) { Text("Edit") }
                }
            }
            if (choosing) {
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Muted("From", modifier = Modifier.align(Alignment.CenterVertically).padding(end = 4.dp))
                    for (account in s.activeAccounts) SelectChip(false, account.name, { choosing = false; log(account.id) })
                }
            }
        } else if (onClick != null) {
            Row(Modifier.padding(start = 8.dp, bottom = 4.dp)) { Spacer(Modifier.weight(1f)); TextButton(onClick = onClick) { Text("Edit") } }
        }
    }
}

internal fun repeatLabel(cost: RecurringCost): String {
    val (count, unit) = app.lifeos.kt.data.logic.recurringInterval(cost)
    return if (count == 1) when (unit) { "day" -> "Daily"; "week" -> "Weekly"; "year" -> "Yearly"; else -> "Monthly" } else "Every $count ${unit}s"
}

/* ------------------------------ quick add ------------------------------ */

/**
 * Add or edit one transaction: direction, a big amount field that's focused
 * straight away, category (with a new one made inline), account and pocket,
 * date, time and a note. Every field the web has, without the clutter: the
 * rarely-changed ones (date, time) sit as one-tap chips.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
internal fun TransactionSheet(s: MoneyState, model: MoneyViewModel, existing: Transaction?, startKind: String, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val key = existing?.id ?: "new"
    var kind by rememberSaveable(key) { mutableStateOf(existing?.kind?.takeIf { it != "adjustment" } ?: startKind) }
    var amount by rememberSaveable(key) { mutableStateOf(existing?.let { plainAmount(abs(it.amount)) } ?: "") }
    var note by rememberSaveable(key) { mutableStateOf(existing?.description.orEmpty()) }
    var accountId by rememberSaveable(key) { mutableStateOf(existing?.accountId ?: s.defaultAccountId!!) }
    var pocketId by rememberSaveable(key) { mutableStateOf(existing?.pocketId) }
    var categoryId by rememberSaveable(key) { mutableStateOf(existing?.categoryId) }
    var date by rememberSaveable(key) { mutableStateOf<String?>(existing?.date ?: s.today.toString()) }
    var time by rememberSaveable(key) { mutableStateOf(existing?.occurredTime ?: LocalTime.now().withNano(0).withSecond(0).format(DateTimeFormatter.ISO_LOCAL_TIME)) }
    var pickingTime by remember { mutableStateOf(false) }
    var newCategory by rememberSaveable(key) { mutableStateOf<String?>(null) }
    val value = parseAmount(amount)
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (existing == null) runCatching { focus.requestFocus() } }

    ModalBottomSheet(onDismissRequest = close, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        // The fields scroll; Save stays pinned above the keyboard, so a quick spend is type, tap.
        Column(Modifier.fillMaxWidth().navigationBarsPadding().imePadding()) {
        Column(
            Modifier.weight(1f, fill = false).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New transaction" else "Edit transaction", style = MaterialTheme.typography.titleLarge)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("expense" to "Money out", "income" to "Money in").forEachIndexed { index, (v, label) ->
                    SegmentedButton(selected = kind == v, onClick = { haptics.tick(); if (kind != v) categoryId = null; kind = v }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text(label) }
                }
            }
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                label = { Text("Amount") },
                singleLine = true,
                textStyle = MaterialTheme.typography.headlineMedium.merge(Numbers),
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
            val forKind = s.categories.filter { it.kind == kind }
            Eyebrow("Category")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SelectChip(categoryId == null, "No category", { categoryId = null })
                for (category in forKind) SelectChip(categoryId == category.id, category.name, { categoryId = category.id })
                if (newCategory == null) SelectChip(false, "New", { newCategory = "" }, leadingIcon = Icons.Outlined.Add)
            }
            newCategory?.let { name ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(name, { newCategory = it }, label = { Text("New category name") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = {
                        if (name.isBlank()) haptics.reject() else { haptics.confirm(); categoryId = model.createCategory(name, kind); newCategory = null }
                    }) { Text("Add") }
                }
            }
            if (s.activeAccounts.size > 1 || existing != null) {
                Eyebrow(if (kind == "income") "Into" else "From")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (account in s.activeAccounts) SelectChip(accountId == account.id, account.name, { if (accountId != account.id) pocketId = null; accountId = account.id })
                }
            }
            val pockets = s.pocketsOf(accountId)
            if (pockets.isNotEmpty()) {
                Eyebrow("Pocket")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SelectChip(pocketId == null, "No pocket", { pocketId = null })
                    for (pocket in pockets) SelectChip(pocketId == pocket.id, pocket.name, { pocketId = pocket.id })
                }
            }
            Eyebrow("When")
            DateChoice(date, { date = it }, allowNone = false, past = true) {
                SelectChip(false, "At ${time.take(5)}", { pickingTime = true }, leadingIcon = Icons.Outlined.Schedule)
            }
            OutlinedTextField(note, { note = it }, label = { Text("Note (optional)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                if (existing != null) {
                    TextButton(onClick = {
                        haptics.confirm()
                        model.delete(existing)
                        close()
                        undo("Transaction deleted") { model.save(existing) }
                    }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        if (value == null || value <= 0) {
                            haptics.reject()
                        } else {
                            haptics.confirm()
                            val base = existing ?: Transaction(id = newId(), accountId = accountId, amount = 0.0, date = date!!)
                            model.save(
                                base.copy(
                                    accountId = accountId,
                                    pocketId = pocketId,
                                    amount = signedAmount(value, kind),
                                    kind = kind,
                                    categoryId = categoryId,
                                    date = date ?: s.today.toString(),
                                    occurredTime = time,
                                    description = note.trim().ifEmpty { null },
                                ),
                            )
                            close()
                        }
                    },
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.height(52.dp),
                ) { Text(if (value != null && value > 0) "Save ${s.money.format(value)}" else "Save") }
            }
        }
    }
    if (pickingTime) {
        PickTime(runCatching { LocalTime.parse(time) }.getOrDefault(LocalTime.now()), dismiss = { pickingTime = false }) { time = it.withSecond(0).format(DateTimeFormatter.ISO_LOCAL_TIME) }
    }
}

/* -------------------------------- payday -------------------------------- */

/** Pay and buffer: when pay arrives (a day of the month, or every few weeks), what usually comes in, and what to keep back. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun PaydaySheet(s: MoneyState, model: MoneyViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val c = s.payday
    var schedule by rememberSaveable { mutableStateOf(c?.schedule ?: "monthly") }
    var payDay by rememberSaveable { mutableStateOf(c?.payDay?.toString() ?: "") }
    var weeks by rememberSaveable { mutableStateOf(c?.intervalWeeks?.toString() ?: "2") }
    var anchor by rememberSaveable { mutableStateOf<String?>(c?.anchorDate ?: s.today.toString()) }
    var net by rememberSaveable { mutableStateOf(c?.expectedNetAmount?.let(::plainAmount) ?: "") }
    var buffer by rememberSaveable { mutableStateOf(c?.safetyBuffer?.let(::plainAmount) ?: "") }

    app.lifeos.kt.feature.tasks.EditorSheet(
        title = if (c == null) "Set up payday" else "Pay and buffer",
        close = close,
        onSave = {
            val day = payDay.toIntOrNull()
            val every = weeks.toIntOrNull()
            val ok = if (schedule == "monthly") day != null && day in 1..31 else every != null && every in 1..8 && anchor != null
            if (!ok) { haptics.reject(); false } else {
                haptics.confirm()
                model.save(
                    (c ?: PaydayConfig(newId())).copy(
                        schedule = schedule,
                        payDay = if (schedule == "monthly") day else null,
                        intervalWeeks = if (schedule == "monthly") null else every,
                        anchorDate = if (schedule == "monthly") null else anchor,
                        expectedNetAmount = parseAmount(net),
                        safetyBuffer = parseAmount(buffer),
                    ),
                )
                true
            }
        },
    ) {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("monthly" to "Monthly", "weekly" to "Every few weeks").forEachIndexed { index, (v, label) ->
                SegmentedButton(selected = (schedule == "monthly") == (v == "monthly"), onClick = { haptics.tick(); schedule = v }, shape = SegmentedButtonDefaults.itemShape(index, 2)) { Text(label) }
            }
        }
        if (schedule == "monthly") {
            NumberField(payDay, { payDay = it.filter(Char::isDigit).take(2) }, "Day of the month (1 to 31)", decimal = false)
            Muted("In shorter months it falls on the last day.", style = MaterialTheme.typography.bodySmall)
        } else {
            NumberField(weeks, { weeks = it.filter(Char::isDigit).take(1) }, "Every how many weeks", decimal = false)
            Eyebrow("A recent payday")
            DateChoice(anchor, { anchor = it }, allowNone = false)
        }
        NumberField(net, { net = it }, "Expected net pay (optional)")
        NumberField(buffer, { buffer = it }, "Safety buffer")
        Muted("The buffer is kept back from left to spend, so a surprise doesn't leave you short.", style = MaterialTheme.typography.bodySmall)
    }
}

/* -------------------------------- shared -------------------------------- */

@Composable
internal fun NumberField(value: String, onChange: (String) -> Unit, label: String, decimal: Boolean = true, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(if (decimal) it.filter { c -> c.isDigit() || c == '.' || c == ',' || c == '-' } else it) },
        label = { Text(label) },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(Numbers),
        shape = MaterialTheme.shapes.medium,
        keyboardOptions = KeyboardOptions(keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number),
        modifier = modifier.fillMaxWidth(),
    )
}

internal fun parseAmount(text: String): Double? = text.trim().replace(",", ".").toDoubleOrNull()

internal fun plainAmount(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

@Composable
internal fun AccountIcon(account: app.lifeos.kt.core.model.Account) {
    app.lifeos.kt.core.designsystem.EntityIcon(
        account.icon,
        account.color,
        fallback = when (account.type) { "savings" -> Icons.Outlined.Savings; else -> Icons.Outlined.AccountBalance },
        size = 34.dp,
    )
}

internal fun accountNote(account: app.lifeos.kt.core.model.Account): String? = listOfNotNull(
    ACCOUNT_TYPES.firstOrNull { it.first == account.type }?.second,
    "Kept separate".takeIf { !account.countsTowardSpendable },
    "Inactive".takeIf { !account.active },
).joinToString(" · ").ifEmpty { null }

internal val ACCOUNT_TYPES = listOf("checking" to "Current account", "savings" to "Savings", "cash" to "Cash", "credit" to "Credit")
internal val POCKET_KINDS = listOf("cash" to "Cash in hand", "debit" to "Debit / bank", "savings" to "Savings")
