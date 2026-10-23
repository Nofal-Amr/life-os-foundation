package app.lifeos.kt.feature.spirit

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.ProgressRing
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.PrayerLog
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.logic.PRAYERS
import app.lifeos.kt.data.logic.PRAYER_STATUSES
import app.lifeos.kt.data.logic.PrayerSlot
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.prayerTimes
import app.lifeos.kt.data.logic.PrayerWindows
import app.lifeos.kt.data.logic.prayerWindows
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

data class SpiritState(val today: LocalDate, val city: String?, val times: List<PrayerSlot>?, val windows: PrayerWindows?, val todays: Map<String, PrayerLog>, val logs: List<PrayerLog>)

@HiltViewModel
class SpiritViewModel @Inject constructor(private val repo: SpiritRepository) : ViewModel() {
    val state: StateFlow<SpiritState?> = combine(repo.settings, repo.logs) { settings, logs ->
        val today = LocalDate.now()
        SpiritState(today, settings?.city, prayerTimes(settings, today), prayerWindows(settings, today), logs.filter { it.prayerDate == today.toString() }.associateBy { it.prayerName }, logs)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun set(prayer: String, status: String?) = viewModelScope.launch {
        val s = state.value ?: return@launch
        repo.setStatus(s.today.toString(), prayer, status, s.logs)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SpiritScreen(model: SpiritViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val haptics = rememberHaptics()
    val clock = DateFormat.getTimeInstance(DateFormat.SHORT)

    LifePage(title = "Spirit", actions = { SyncAction() }, refreshing = sync.state.running, onRefresh = sync.syncNow) {
        val s = state
        if (s == null) {
            items(5) { Skeleton(height = 104.dp) }
            return@LifePage
        }
        val logged = PRAYERS.count { (key, _) -> prayerStatus(s.todays[key]).let { it != null && it != "missed" } }
        item {
            LifeCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Eyebrow(s.today.format(DateTimeFormatter.ofPattern("EEEE d MMMM")))
                        Text("$logged of 5 prayed", style = MaterialTheme.typography.titleLarge)
                        Muted(s.city?.let { "Times for $it" } ?: "Times show once your place is set", style = MaterialTheme.typography.bodySmall)
                    }
                    ProgressRing(logged / 5f)
                }
            }
        }
        if (s.times == null) {
            item { EmptyState(Icons.Outlined.LocationOn, "No place set yet", "Set your city in Spirit settings on the website; the times then work offline here.") }
        }
        val now = Date()
        val next = s.times?.firstOrNull { it.at.after(now) }?.key
        items(PRAYERS, key = { it.first }) { (key, label) ->
            val status = prayerStatus(s.todays[key])
            val isNext = key == next
            val container by animateColorAsState(
                if (isNext) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer,
                label = "next",
            )
            LifeCard(color = container) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(label, style = MaterialTheme.typography.titleMedium)
                        if (isNext) Muted("Next", style = MaterialTheme.typography.bodySmall)
                    }
                    s.times?.firstOrNull { it.key == key }?.let { Text(clock.format(it.at), style = MaterialTheme.typography.titleMedium) }
                }
                // Fajr's time runs until sunrise; Isha's suggested points split the time until the next Fajr.
                s.windows?.let { w ->
                    when (key) {
                        "fajr" -> Muted("Sunrise ${clock.format(w.sunrise)} · Fajr's time ends", style = MaterialTheme.typography.bodySmall)
                        "isha" -> {
                            Muted("Best by ${clock.format(w.ishaFirstThird)} · by ${clock.format(w.ishaHalf)} if needed", style = MaterialTheme.typography.bodySmall)
                            Muted("Until Fajr ${clock.format(w.nextFajr)} only if absolutely necessary", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((value, text) in PRAYER_STATUSES) {
                        SelectChip(status == value, text, {
                            if (status != value && value != "missed") haptics.confirm()
                            model.set(key, if (status == value) null else value)
                        })
                    }
                }
            }
        }
        item { Spacer(Modifier.width(1.dp)) }
    }
}
