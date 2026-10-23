package app.lifeos.kt.feature.today

import androidx.compose.animation.animateContentSize
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons

import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.designsystem.AnimatedNumber
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.ProgressRing
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.PrayerSlot
import app.lifeos.kt.data.logic.dueDetail
import app.lifeos.kt.data.logic.isOpen
import app.lifeos.kt.data.logic.leftToSpend
import app.lifeos.kt.data.logic.nextAction
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.prayerTimes
import app.lifeos.kt.data.logic.spentDuring
import app.lifeos.kt.navigation.Section
import dagger.hilt.android.lifecycle.HiltViewModel
import java.text.DateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Date
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class TodayState(
    val today: LocalDate,
    val next: Task?,
    val due: List<Task>,
    val money: MoneyFormatter,
    val left: Double,
    val hasAccounts: Boolean,
    val spentToday: Double,
    val prayerTimes: List<PrayerSlot>?,
    val prayersLogged: Int,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
)

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val tasks: TaskRepository,
    money: MoneyRepository,
    spirit: SpiritRepository,
    private val plan: PlanRepository,
    prefs: PreferencesRepository,
) : ViewModel() {
    private val moneyFlow = combine(money.accounts, money.transactions, prefs.preferences) { a, t, p -> Triple(a, t, p) }
    private val spiritFlow = combine(spirit.settings, spirit.logs) { s, l -> s to l }
    private val habitFlow = combine(plan.habits, plan.habitLogs) { h, l -> h to l }

    val state: StateFlow<TodayState?> = combine(tasks.tasks, moneyFlow, spiritFlow, habitFlow) { taskList, (accounts, transactions, prefs), (settings, logs), (habits, habitLogs) ->
        val today = LocalDate.now()
        val todayText = today.toString()
        val next = nextAction(taskList)
        TodayState(
            today = today,
            next = next,
            // The next action is already shown on its own above, so it isn't repeated here.
            due = taskList.filter { it.isOpen() && it.parentTaskId == null && (it.dueDate ?: "9999") <= todayText && it.id != next?.id }
                .sortedWith(compareBy({ it.dueDate }, { it.dueTime ?: "99" })),
            money = MoneyFormatter(prefs?.currency),
            left = leftToSpend(accounts, transactions),
            hasAccounts = accounts.any { it.active },
            spentToday = spentDuring(transactions, todayText),
            prayerTimes = prayerTimes(settings, today),
            prayersLogged = logs.count { it.prayerDate == todayText && prayerStatus(it).let { s -> s != null && s != "missed" } && it.prayerName in FIVE },
            habits = habits.filter { it.active && it.frequency == "daily" }.sortedBy { it.name.lowercase() },
            habitLogs = habitLogs.filter { it.logDate == todayText },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun finish(task: Task) = viewModelScope.launch { tasks.setDone(task, true) }
    fun restore(task: Task) = viewModelScope.launch { tasks.restore(task) }
    fun toggleHabit(habit: Habit) = viewModelScope.launch {
        state.value?.let { plan.toggleHabit(habit, it.today.toString(), it.habitLogs) }
    }

    private companion object {
        val FIVE = setOf("fajr", "dhuhr", "asr", "maghrib", "isha")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TodayScreen(open: (Section) -> Unit, model: TodayViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val finish = { task: Task -> haptics.confirm(); model.finish(task); undo("Finished “${task.title}”") { model.restore(task) } }

    LifePage(
        title = "Today",
        subtitle = LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, d MMMM")),
        actions = { SyncAction() },
        refreshing = sync.state.running,
        onRefresh = sync.syncNow,
    ) {
        val s = state
        if (s == null) {
            items(3) { Skeleton(height = 112.dp) }
            return@LifePage
        }

        // The one next thing, first.
        item {
            LifeCard(onClick = { open(Section.Do) }, color = MaterialTheme.colorScheme.primaryContainer) {
                Eyebrow("Next", color = MaterialTheme.colorScheme.onPrimaryContainer)
                Spacer(Modifier.height(6.dp))
                val next = s.next
                if (next == null) {
                    Text("Nothing with a date right now", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Muted("Plan something from Do when you're ready.")
                } else {
                    Text(next.title, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onPrimaryContainer, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    dueDetail(next, s.today)?.let { Muted(it) }
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { finish(next) }, shape = MaterialTheme.shapes.medium) {
                        Icon(Icons.Outlined.TaskAlt, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Done")
                    }
                }
            }
        }

        // Money and prayer, side by side.
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LifeCard(Modifier.weight(1f), onClick = { open(Section.Money) }) {
                    IconBadge(Icons.Outlined.AccountBalanceWallet, size = 32.dp)
                    Spacer(Modifier.height(10.dp))
                    Eyebrow("Left to spend")
                    if (s.hasAccounts) {
                        AnimatedNumber(s.left, s.money::short, MaterialTheme.typography.titleLarge)
                        Muted("Spent today ${s.money.short(s.spentToday)}", style = MaterialTheme.typography.bodySmall)
                    } else {
                        Text("No accounts yet", style = MaterialTheme.typography.titleMedium)
                        Muted("Add them on the website", style = MaterialTheme.typography.bodySmall)
                    }
                }
                LifeCard(Modifier.weight(1f), onClick = { open(Section.Spirit) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBadge(Icons.Outlined.DarkMode, size = 32.dp)
                        Spacer(Modifier.weight(1f))
                        // Five prayers a day: a real denominator.
                        ProgressRing(s.prayersLogged / 5f, size = 32.dp, stroke = 4.dp)
                    }
                    Spacer(Modifier.height(10.dp))
                    val upcoming = s.prayerTimes?.firstOrNull { it.at.after(Date()) }
                    Eyebrow(if (upcoming != null) "Next prayer" else "Prayer")
                    Text(
                        when {
                            s.prayerTimes == null -> "Set your place"
                            upcoming != null -> "${upcoming.label} ${DateFormat.getTimeInstance(DateFormat.SHORT).format(upcoming.at)}"
                            else -> "Isha has passed"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Muted("${s.prayersLogged} of 5 logged", style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (s.habits.isNotEmpty()) {
            item { SectionHeader("Habits today") }
            item {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (habit in s.habits) {
                        SelectChip(selected = s.habitLogs.any { it.habitId == habit.id }, label = habit.name, onClick = { model.toggleHabit(habit) })
                    }
                }
            }
        }

        item { SectionHeader(if (s.due.isEmpty()) "Nothing due today" else "Due", action = "All tasks", onAction = { open(Section.Do) }) }
        if (s.due.isNotEmpty()) {
            item {
                LifeCard(Modifier.animateContentSize(), contentPadding = PaddingValues(vertical = 6.dp)) {
                    for (task in s.due.take(6)) {
                        Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { finish(task) }) {
                                Icon(Icons.Outlined.Circle, contentDescription = "Finish ${task.title}", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                                Text(task.title, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                dueDetail(task, s.today)?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
                            }
                        }
                    }
                    if (s.due.size > 6) Muted("and ${s.due.size - 6} more in Do", Modifier.padding(start = 20.dp, bottom = 8.dp))
                }
            }
        }
    }
}

