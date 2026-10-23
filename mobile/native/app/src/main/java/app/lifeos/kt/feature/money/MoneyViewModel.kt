package app.lifeos.kt.feature.money

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.model.Account
import app.lifeos.kt.core.model.AccountPocket
import app.lifeos.kt.core.model.FinanceCategory
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.PaydayConfig
import app.lifeos.kt.core.model.RecurringCost
import app.lifeos.kt.core.model.Transaction
import app.lifeos.kt.data.Created
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.logic.BeforePayday
import app.lifeos.kt.data.logic.PaydayCycle
import app.lifeos.kt.data.logic.WeeklySpend
import app.lifeos.kt.data.logic.accountBalance
import app.lifeos.kt.data.logic.availableBeforePayday
import app.lifeos.kt.data.logic.hasPaydaySetup
import app.lifeos.kt.data.logic.monthlyEquivalent
import app.lifeos.kt.data.logic.nextPayday
import app.lifeos.kt.data.logic.paydayCycle
import app.lifeos.kt.data.logic.pocketBalance
import app.lifeos.kt.data.logic.spentDuring
import app.lifeos.kt.data.logic.weeklySpendByCategory
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlin.math.abs
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class MoneyState(
    val money: MoneyFormatter,
    val today: LocalDate,
    val accounts: List<Account>,
    val transactions: List<Transaction>,
    val categories: List<FinanceCategory>,
    val pockets: List<AccountPocket>,
    val recurring: List<RecurringCost>,
    val payday: PaydayConfig?,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
    /** Null until payday is set up, so no half-worked figure is ever shown. */
    val nextPayday: LocalDate?,
    val totals: BeforePayday,
    val cycle: PaydayCycle?,
    val weekly: WeeklySpend,
    val spentToday: Double,
    val todayCount: Int,
    val spentByCategoryThisMonth: Map<String, Double>,
    val balances: Map<String, Double>,
    val pocketBalances: Map<String, Double>,
    val monthlyRecurring: Double,
) {
    val setup: Boolean get() = hasPaydaySetup(payday)
    val activeAccounts: List<Account> get() = accounts.filter { it.active }
    val separate: List<Pair<Account, Double>> get() = activeAccounts.filter { it.type != "credit" && !it.countsTowardSpendable }.map { it to (balances[it.id] ?: 0.0) }
    val accountNames: Map<String, String> get() = accounts.associate { it.id to it.name }
    val categoryNames: Map<String, String> get() = categories.associate { it.id to it.name }
    val moneyHabits: List<Habit> get() = habits.filter { it.active && it.category == "money" }
    fun pocketsOf(accountId: String) = pockets.filter { it.accountId == accountId }
    /** Where new money goes by default: the first account that counts toward spending. */
    val defaultAccountId: String? get() = (activeAccounts.firstOrNull { it.countsTowardSpendable && it.type != "credit" } ?: activeAccounts.firstOrNull())?.id
}

private fun <A, B, C, D, E, F, R> combine6(a: Flow<A>, b: Flow<B>, c: Flow<C>, d: Flow<D>, e: Flow<E>, f: Flow<F>, block: (A, B, C, D, E, F) -> R): Flow<R> =
    combine(combine(a, b, c) { x, y, z -> Triple(x, y, z) }, combine(d, e, f) { x, y, z -> Triple(x, y, z) }) { (x, y, z), (u, v, w) -> block(x, y, z, u, v, w) }

private data class Raw(
    val accounts: List<Account>, val transactions: List<Transaction>, val categories: List<FinanceCategory>,
    val pockets: List<AccountPocket>, val recurring: List<RecurringCost>, val payday: PaydayConfig?,
)

@HiltViewModel
class MoneyViewModel @Inject constructor(private val repo: MoneyRepository, private val plan: PlanRepository, prefs: PreferencesRepository) : ViewModel() {
    private val raw = combine6(repo.accounts, repo.transactions, repo.categories, repo.pockets, repo.recurring, repo.payday) { a, t, c, p, r, d -> Raw(a, t, c, p, r, d) }

    val state: StateFlow<MoneyState?> = combine(raw, plan.habits, plan.habitLogs, prefs.preferences) { r, habits, logs, p ->
        val today = LocalDate.now()
        val iso = today.toString()
        val payday = nextPayday(r.payday, today)
        val balances = r.accounts.associate { it.id to accountBalance(it, r.transactions, r.pockets) }
        MoneyState(
            money = MoneyFormatter(p?.currency ?: r.accounts.firstNotNullOfOrNull { it.currency }),
            today = today,
            accounts = r.accounts.sortedWith(compareByDescending<Account> { it.active }.thenBy { it.name.lowercase() }),
            transactions = r.transactions.sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.occurredTime ?: "" }),
            categories = r.categories.sortedBy { it.name.lowercase() },
            pockets = r.pockets,
            recurring = r.recurring.sortedWith(compareByDescending<RecurringCost> { it.active }.thenBy { it.nextDueDate }),
            payday = r.payday,
            habits = habits,
            habitLogs = logs,
            nextPayday = payday,
            totals = availableBeforePayday(r.accounts, r.transactions, r.recurring, payday, r.payday?.safetyBuffer, r.pockets),
            cycle = paydayCycle(r.payday, today),
            weekly = weeklySpendByCategory(r.transactions, r.categories, today),
            spentToday = spentDuring(r.transactions, iso),
            todayCount = r.transactions.count { it.kind == "expense" && it.date.startsWith(iso) },
            spentByCategoryThisMonth = r.transactions.filter { it.kind == "expense" && it.date.startsWith(iso.take(7)) && it.categoryId != null }
                .groupBy { it.categoryId!! }.mapValues { (_, list) -> list.sumOf { abs(it.amount) } },
            balances = balances,
            pocketBalances = r.pockets.associate { it.id to pocketBalance(it, r.transactions) },
            monthlyRecurring = r.recurring.sumOf { abs(monthlyEquivalent(it)) },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(transaction: Transaction) = viewModelScope.launch { repo.save(transaction) }
    fun delete(transaction: Transaction) = viewModelScope.launch { repo.delete(transaction) }
    fun save(account: Account) = viewModelScope.launch { repo.save(account) }
    fun delete(account: Account) = viewModelScope.launch { repo.delete(account) }
    fun save(pocket: AccountPocket) = viewModelScope.launch { repo.save(pocket) }
    fun delete(pocket: AccountPocket) = viewModelScope.launch { repo.delete(pocket) }
    fun save(category: FinanceCategory) = viewModelScope.launch { repo.save(category) }
    fun delete(category: FinanceCategory) = viewModelScope.launch { repo.delete(category) }
    fun save(cost: RecurringCost) = viewModelScope.launch { repo.save(cost) }
    fun delete(cost: RecurringCost) = viewModelScope.launch { repo.delete(cost) }
    fun save(config: PaydayConfig) = viewModelScope.launch { repo.save(config) }
    fun addStarters(existing: List<FinanceCategory>) = viewModelScope.launch { repo.addStarterCategories(existing) }
    fun skip(cost: RecurringCost) = viewModelScope.launch { repo.skipRecurring(cost) }
    fun toggleHabit(habit: Habit, logs: List<HabitLog>) = viewModelScope.launch { plan.toggleHabit(habit, LocalDate.now().toString(), logs) }

    /** Logs a recurring cost; [done] gets an Undo that removes the expense and puts the date back. */
    fun log(cost: RecurringCost, accountId: String, done: (undo: () -> Unit) -> Unit) = viewModelScope.launch {
        val created: Created = repo.logRecurring(cost, accountId)
        done { viewModelScope.launch { repo.remove(created); repo.save(cost) } }
    }

    /** A new category from inside another form; returns its id straight away so it can be selected. */
    fun createCategory(name: String, kind: String): String {
        val id = newId()
        viewModelScope.launch { repo.save(FinanceCategory(id, name.trim(), kind)) }
        return id
    }
}
