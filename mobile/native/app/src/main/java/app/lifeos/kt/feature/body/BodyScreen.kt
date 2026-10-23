package app.lifeos.kt.feature.body

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Bedtime
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Medication
import androidx.compose.material.icons.outlined.WaterDrop
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
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
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.AnimatedNumber
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.model.HealthLog
import app.lifeos.kt.core.model.Medication
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** The web app's mood words (MOOD_LABELS in src/data/reviews.ts), 1 to 5. */
private val MOODS = listOf(1 to "Low", 2 to "Meh", 3 to "Okay", 4 to "Good", 5 to "Great")

data class BodyState(val today: LocalDate, val todayLog: HealthLog?, val recent: List<HealthLog>, val medications: List<Medication>)

@HiltViewModel
class BodyViewModel @Inject constructor(private val repo: BodyRepository) : ViewModel() {
    val state: StateFlow<BodyState?> = combine(repo.healthLogs, repo.medications) { logs, meds ->
        val today = LocalDate.now()
        val todayText = today.toString()
        BodyState(
            today,
            logs.firstOrNull { it.logDate == todayText },
            logs.filter { it.logDate < todayText }.sortedByDescending { it.logDate }.take(14),
            meds.filter { it.active }.sortedBy { it.name.lowercase() },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Changes today's log, creating it on the first change. */
    fun update(change: (HealthLog) -> HealthLog) = viewModelScope.launch {
        val s = state.value ?: return@launch
        repo.save(change(s.todayLog ?: HealthLog(newId(), s.today.toString())))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BodyScreen(model: BodyViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val haptics = rememberHaptics()

    LifePage(title = "Body", actions = { SyncAction() }, refreshing = sync.state.running, onRefresh = sync.syncNow) {
        val s = state
        if (s == null) {
            items(3) { Skeleton(height = 96.dp) }
            return@LifePage
        }
        val log = s.todayLog
        item { SectionHeader("Today") }
        item {
            LifeCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBadge(Icons.Outlined.Bedtime, size = 36.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Eyebrow("Sleep")
                        val hours = log?.sleepHours
                        if (hours == null) Text("Not logged", style = MaterialTheme.typography.titleLarge)
                        else AnimatedNumber(hours, { "${trim(it)} h" }, MaterialTheme.typography.titleLarge)
                    }
                    FilledTonalIconButton(onClick = { haptics.tick(); model.update { it.copy(sleepHours = ((it.sleepHours ?: 7.0) - 0.5).coerceAtLeast(0.0)) } }) {
                        Icon(Icons.Filled.Remove, "Half an hour less")
                    }
                    Spacer(Modifier.width(6.dp))
                    FilledTonalIconButton(onClick = { haptics.tick(); model.update { it.copy(sleepHours = ((it.sleepHours ?: 7.0) + 0.5).coerceAtMost(24.0)) } }) {
                        Icon(Icons.Filled.Add, "Half an hour more")
                    }
                }
            }
        }
        item {
            LifeCard {
                Eyebrow("Mood")
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((value, label) in MOODS) {
                        SelectChip(log?.mood == value, label, { model.update { it.copy(mood = if (it.mood == value) null else value) } })
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ToggleTile(Modifier.weight(1f), Icons.Outlined.WaterDrop, "Water", if (log?.waterOk == true) "Enough today" else "Tap when enough", log?.waterOk == true) {
                    model.update { it.copy(waterOk = it.waterOk != true) }
                }
                ToggleTile(Modifier.weight(1f), Icons.Outlined.FitnessCenter, "Training", if (log?.trained == true) "Trained today" else "Tap when done", log?.trained == true) {
                    model.update { it.copy(trained = it.trained != true) }
                }
            }
        }
        if (s.medications.isNotEmpty()) {
            item { SectionHeader("Medication") }
            items(s.medications, key = { it.id }) { med ->
                LifeCard(Modifier.animateItem()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBadge(Icons.Outlined.Medication, size = 34.dp)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(med.name + (med.dosage?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodyLarge)
                            med.scheduleTimes?.takeIf { it.isNotEmpty() }?.let { times -> Muted(times.joinToString(" · ") { it.take(5) }, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }
        }
        if (s.recent.isNotEmpty()) {
            item { SectionHeader("Recent days") }
            item {
                LifeCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 6.dp)) {
                    for (day in s.recent) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                            Text(friendlyDate(day.logDate) ?: day.logDate, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(120.dp))
                            Muted(
                                listOfNotNull(
                                    day.sleepHours?.let { "${trim(it)} h sleep" },
                                    day.mood?.let { m -> MOODS.toMap()[m] },
                                    "trained".takeIf { day.trained == true },
                                ).joinToString(" · ").ifEmpty { "—" },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ToggleTile(modifier: Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, caption: String, on: Boolean, toggle: () -> Unit) {
    val haptics = rememberHaptics()
    LifeCard(
        modifier,
        onClick = { if (on) haptics.tick() else haptics.confirm(); toggle() },
        color = if (on) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer,
    ) {
        IconBadge(icon, size = 32.dp)
        Spacer(Modifier.height(10.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        Muted(caption, style = MaterialTheme.typography.bodySmall)
    }
}

private fun trim(value: Double) = if (value % 1.0 == 0.0) value.toInt().toString() else "%.1f".format(value)
