package app.lifeos.kt.feature.spirit

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.model.DhikrLog
import app.lifeos.kt.core.model.Habit
import app.lifeos.kt.core.model.HabitLog
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.core.model.PrayerSettings
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.logic.AzkarData
import app.lifeos.kt.data.logic.PrayerSlot
import app.lifeos.kt.data.logic.PrayerWindows
import app.lifeos.kt.data.logic.parseAzkar
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.prayerTimes
import app.lifeos.kt.data.logic.prayerWindows
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class SpiritState(
    val date: LocalDate,
    val today: LocalDate,
    val settings: PrayerSettings?,
    val times: List<PrayerSlot>?,
    val windows: PrayerWindows?,
    /** Today's times, for the azkar time and the Qibla, whatever day the list shows. */
    val todayTimes: List<PrayerSlot>?,
    val logs: List<PrayerLog>,
    val dhikr: List<DhikrLog>,
    val habits: List<Habit>,
    val habitLogs: List<HabitLog>,
) {
    val iso get() = date.toString()
    fun status(name: String) = prayerStatus(logs.firstOrNull { it.prayerDate == iso && it.prayerName == name })
    val spiritHabits get() = habits.filter { it.active && it.category == "spirit" }
}

@HiltViewModel
class SpiritViewModel @Inject constructor(
    private val repo: SpiritRepository,
    private val plan: PlanRepository,
    @ApplicationContext context: Context,
) : ViewModel() {
    private val date = MutableStateFlow(LocalDate.now())

    /** The azkar texts, exactly as on the website (assets/azkar.json). */
    val azkar: AzkarData = context.assets.open("azkar.json").bufferedReader(Charsets.UTF_8).use { parseAzkar(it.readText()) }

    val state: StateFlow<SpiritState?> = combine(date, repo.settings, repo.logs, repo.dhikr, combine(plan.habits, plan.habitLogs) { h, l -> h to l }) { d, settings, logs, dhikr, (habits, habitLogs) ->
        val today = LocalDate.now()
        SpiritState(
            date = d,
            today = today,
            settings = settings,
            times = prayerTimes(settings, d),
            windows = prayerWindows(settings, d),
            todayTimes = prayerTimes(settings, today),
            logs = logs,
            dhikr = dhikr.sortedByDescending { it.createdAt ?: it.logDate },
            habits = habits,
            habitLogs = habitLogs,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setDate(value: LocalDate) { date.value = value }

    fun setStatus(s: SpiritState, name: String, status: String?) = viewModelScope.launch { repo.setStatus(s.iso, name, status, s.logs) }

    fun toggleHabit(s: SpiritState, habit: Habit) = viewModelScope.launch { plan.toggleHabit(habit, s.iso, s.habitLogs) }

    fun saveSettings(s: SpiritState, change: (PrayerSettings) -> PrayerSettings) = viewModelScope.launch {
        repo.save(change(s.settings ?: PrayerSettings(newId())))
    }

    fun logDhikr(kind: String, count: Int, label: String? = null, done: (DhikrLog) -> Unit = {}) = viewModelScope.launch {
        done(repo.logDhikr(LocalDate.now().toString(), kind, count, label))
    }

    fun delete(log: DhikrLog) = viewModelScope.launch { repo.delete(log) }
}
