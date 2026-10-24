package app.lifeos.kt.feature.calendar

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.HolidayRepository
import app.lifeos.kt.data.HolidaySettings
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.logic.CalItem
import app.lifeos.kt.data.logic.Source
import app.lifeos.kt.data.logic.calendarItems
import app.lifeos.kt.data.logic.prayerTimes
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class CalView(val label: String) { Day("Day"), Week("Week"), Month("Month"), Schedule("Schedule") }

data class CalendarState(
    val items: List<CalItem>,
    val weekStart: Int,
    val prayers: PrayerSettings?,
    val holidaySettings: HolidaySettings,
) {
    private val byDay: Map<LocalDate, List<CalItem>> = items.groupBy { it.date }.mapValues { (_, list) -> list.sortedBy { it.start } }
    fun on(day: LocalDate, hidden: Set<Source>) = byDay[day].orEmpty().filter { it.source !in hidden }
    /** The five prayer times as quiet marks on the time grid. */
    fun prayerMarks(day: LocalDate): List<Pair<String, LocalTime>> =
        prayerTimes(prayers, day)?.map { slot -> app.lifeos.kt.data.logic.prayerLabel(slot.key, day) to slot.at.toInstant().atZone(ZoneId.systemDefault()).toLocalTime() }.orEmpty()
}

private data class Plan(val events: List<CalendarEvent>, val tasks: List<app.lifeos.kt.core.model.Task>, val projects: List<app.lifeos.kt.core.model.Project>, val goals: List<app.lifeos.kt.core.model.Goal>)

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val planner: PlannerRepository,
    tasks: TaskRepository,
    plan: PlanRepository,
    money: MoneyRepository,
    body: BodyRepository,
    spirit: SpiritRepository,
    prefs: PreferencesRepository,
    private val holidays: HolidayRepository,
    @ApplicationContext context: Context,
) : ViewModel() {
    private val store = context.getSharedPreferences("calendar", Context.MODE_PRIVATE)

    /** The view is remembered on the phone, as the web remembers it in the browser. */
    val view = MutableStateFlow(runCatching { CalView.valueOf(store.getString("view", null)!!) }.getOrDefault(CalView.Month))
    /** Health logs mark nearly every day: off by default so events stand out (as on the web). */
    val hidden = MutableStateFlow(store.getStringSet("hidden", setOf(Source.Health.name))!!.mapNotNull { runCatching { Source.valueOf(it) }.getOrNull() }.toSet())
    val showPrayers = MutableStateFlow(store.getBoolean("prayers", true))

    private val planFlow = combine(planner.events, tasks.tasks, plan.projects, plan.goals) { e, t, p, g -> Plan(e, t, p, g) }

    val state: StateFlow<CalendarState?> = combine(
        planFlow,
        combine(money.recurring, body.healthLogs) { r, h -> r to h },
        combine(holidays.holidays, holidays.settings) { list, s -> list to s },
        spirit.settings,
        prefs.preferences,
    ) { p, (costs, health), (holidayList, holidaySettings), prayer, pr ->
        val formatter = MoneyFormatter(pr?.currency)
        CalendarState(
            items = calendarItems(p.events, p.tasks, p.projects, p.goals, costs, health, holidayList, formatter::format),
            weekStart = pr?.weekStart ?: 1,
            prayers = prayer,
            holidaySettings = holidaySettings,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        viewModelScope.launch { holidays.refresh() }
    }

    fun setView(value: CalView) { view.value = value; store.edit().putString("view", value.name).apply() }
    fun toggle(source: Source) {
        val next = if (source in hidden.value) hidden.value - source else hidden.value + source
        hidden.value = next
        store.edit().putStringSet("hidden", next.map { it.name }.toSet()).apply()
    }
    fun togglePrayers() { showPrayers.value = !showPrayers.value; store.edit().putBoolean("prayers", showPrayers.value).apply() }

    fun save(event: CalendarEvent) = viewModelScope.launch { planner.save(event) }
    fun delete(event: CalendarEvent) = viewModelScope.launch { planner.delete(event) }

    fun updateHolidays(change: (HolidaySettings) -> HolidaySettings) = viewModelScope.launch { holidays.update(change) }
    suspend fun countries() = holidays.countries()
    suspend fun allHolidays() = holidays.all()
}
