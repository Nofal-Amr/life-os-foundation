package app.lifeos.kt.feature.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.HubLine
import app.lifeos.kt.data.logic.MonthRow
import app.lifeos.kt.data.logic.Pairing
import app.lifeos.kt.data.logic.Sources
import app.lifeos.kt.data.logic.WeekdayPattern
import app.lifeos.kt.data.logic.byMonth
import app.lifeos.kt.data.logic.dailySeries
import app.lifeos.kt.data.logic.habitByWeekday
import app.lifeos.kt.data.logic.hubLines
import app.lifeos.kt.data.logic.pairingLine
import app.lifeos.kt.data.logic.pairings
import app.lifeos.kt.data.logic.weekCounts
import app.lifeos.kt.data.logic.weekRecap
import app.lifeos.kt.data.logic.weekStartOf
import app.lifeos.kt.data.moduleOn
import app.lifeos.kt.feature.today.HubCard
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

data class InsightsState(
    val hub: List<HubLine>,
    val weeks: List<Pair<LocalDate, List<String>>>,
    val months: List<MonthRow>,
    val together: List<Pairing>,
    val habits: List<Pair<Habit, List<WeekdayPattern>>>,
    val weekStart: Int,
    val money: MoneyFormatter,
)

@HiltViewModel
class InsightsViewModel @Inject constructor(
    tasks: TaskRepository,
    plan: PlanRepository,
    spirit: SpiritRepository,
    money: MoneyRepository,
    body: BodyRepository,
    prefs: PreferencesRepository,
    today: app.lifeos.kt.data.TodayRepository,
) : ViewModel() {
    val state: StateFlow<InsightsState?> = combine(
        combine(tasks.tasks, plan.habits, plan.habitLogs) { t, h, l -> Triple(t, h, l) },
        combine(spirit.logs, money.transactions, body.samples) { p, x, s -> Triple(p, x, s) },
        combine(body.medications, today.medicationLogs) { m, ml -> m to ml },
        prefs.preferences,
    ) { (taskList, habits, habitLogs), (prayerLogs, transactions, samples), (meds, medLogs), p ->
        val day = LocalDate.now()
        val sources = Sources(taskList, prayerLogs, transactions, habitLogs, habits, samples)
        val formatter = MoneyFormatter(p?.currency)
        val weekStart = p?.weekStart ?: 1
        val prayers = moduleOn(p?.enabledModules, "spirit")
        val thisWeek = weekStartOf(day, weekStart)
        InsightsState(
            hub = hubLines(day, taskList, prayerLogs, meds, medLogs, habits, habitLogs, transactions),
            weeks = (0L..3L).map { back ->
                val start = thisWeek.minusWeeks(back)
                start to weekRecap(weekCounts(start, day, taskList, habits, habitLogs, prayerLogs, transactions, prayers), formatter::format)
            }.filter { it.second.isNotEmpty() },
            months = byMonth(sources, day).reversed(),
            together = pairings(dailySeries(sources, day)),
            habits = habits.filter { it.active }.map { h ->
                h to habitByWeekday(h.id, h.createdAt?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }, habitLogs, day)
            },
            weekStart = weekStart,
            money = formatter,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

/** History and insights: only what was logged; counts and patterns with the days they rest on. */
@Composable
fun InsightsScreen(back: @Composable () -> Unit, model: InsightsViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    LifePage(title = "Insights", subtitle = "Only what you logged: counts, and patterns with how many days they're based on.", navigationIcon = back) {
        val s = state ?: return@LifePage
        item(key = "hub") { HubCard(s.hub) }

        if (s.weeks.isNotEmpty()) {
            item(key = "weeks-h") { SectionHeader("Week by week") }
            item(key = "weeks") {
                LifeCard {
                    s.weeks.forEachIndexed { i, (start, lines) ->
                        if (i > 0) HorizontalDivider(Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant)
                        Text(if (i == 0) "This week" else "From ${start.format(DateTimeFormatter.ofPattern("d MMM"))}", style = MaterialTheme.typography.titleSmall)
                        for (line in lines) Muted(line, Modifier.padding(top = 3.dp))
                    }
                }
            }
        }

        item(key = "months-h") { SectionHeader("Month by month") }
        item(key = "months") {
            LifeCard {
                Row {
                    Spacer(Modifier.weight(1.4f))
                    for (h in listOf("Tasks", "Prayed", "Spent", "Habits")) Muted(h, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall.copy(textAlign = TextAlign.End))
                }
                for (row in s.months) {
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(row.month.month.getDisplayName(TextStyle.SHORT, Locale.getDefault()) + " " + row.month.year.toString().takeLast(2), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1.4f))
                        Cell("${row.tasksDone}")
                        Cell("${row.prayed}")
                        Cell(if (row.spent > 0) s.money.format(row.spent).replace(Regex("\\.\\d+$"), "") else "0")
                        Cell("${row.habitCheckIns}")
                    }
                }
            }
        }

        item(key = "together-h") { SectionHeader("What went together") }
        item(key = "together") {
            LifeCard {
                Muted("From the last 90 days, only days where both were logged. A pattern in your days, not proof that one causes the other.", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                if (s.together.isEmpty()) Muted("Nothing clear yet. A pattern needs at least 14 days where both things were logged, and most pairs don't move together.")
                for (p in s.together) {
                    Column(Modifier.padding(vertical = 6.dp)) {
                        Text(pairingLine(p), style = MaterialTheme.typography.bodyMedium)
                        Muted("${p.strength.replaceFirstChar { it.uppercase() }} link (r = ${p.r}) · ${p.days} days", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        item(key = "habits-h") { SectionHeader("Habits by weekday") }
        item(key = "habits") {
            LifeCard {
                Muted("How many of the last 8 of each day you logged it.", style = MaterialTheme.typography.bodySmall)
                if (s.habits.isEmpty()) Muted("No habits yet.", Modifier.padding(top = 8.dp))
                val order = (0..6).map { (s.weekStart + it) % 7 }
                for ((habit, pattern) in s.habits) {
                    Text(habit.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (w in order) {
                            val day = pattern[w]
                            val share = if (day.of > 0) day.done.toFloat() / day.of else 0f
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Muted(java.time.DayOfWeek.of(if (w == 0) 7 else w).getDisplayName(TextStyle.SHORT, Locale.getDefault()), style = MaterialTheme.typography.labelSmall)
                                Box(
                                    Modifier.fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f + 0.4f * share))
                                        .padding(vertical = 6.dp),
                                    contentAlignment = Alignment.Center,
                                ) { Text(if (day.of > 0) "${day.done}/${day.of}" else "—", style = MaterialTheme.typography.labelSmall.merge(Numbers)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Cell(text: String) =
    Text(text, style = MaterialTheme.typography.bodyMedium.merge(Numbers), textAlign = TextAlign.End, modifier = Modifier.weight(1f), maxLines = 1)
