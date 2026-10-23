package app.lifeos.kt.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import java.time.LocalDate
import kotlinx.coroutines.launch
import org.json.JSONObject

private val MOODS = listOf(1 to "Low", 2 to "Meh", 3 to "OK", 4 to "Good", 5 to "Great")

/** Body: today's check-in (sleep, mood, water, training), medication, and the last two weeks. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BodyScreen() {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    val logs = table("health_logs")
    val medications = table("medications").orEmpty().filter { it.optBoolean("active", true) }
    val today = LocalDate.now()
    val todayText = today.toString()

    Column(Modifier.fillMaxSize()) {
        PageHeader("Body")
        if (logs == null) return@Column
        val todayLog = logs.firstOrNull { it.optString("log_date") == todayText }

        /** Changes one field of today's log, creating it if needed. */
        fun update(key: String, value: Any?) {
            val row = JSONObject((todayLog ?: JSONObject().put("log_date", todayText)).toString())
            row.put(key, value ?: JSONObject.NULL)
            scope.launch { rows.save("health_logs", row) }
        }

        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
            item {
                Panel {
                    Text("Today", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    val sleep = todayLog?.takeIf { !it.isNull("sleep_hours") }?.optDouble("sleep_hours")
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Sleep", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                        IconButton(onClick = { update("sleep_hours", ((sleep ?: 7.0) - 0.5).coerceAtLeast(0.0)) }) {
                            Icon(Icons.Filled.Remove, contentDescription = "Less sleep")
                        }
                        Text(sleep?.let { "${trim(it)} h" } ?: "—", style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = { update("sleep_hours", ((sleep ?: 7.0) + 0.5).coerceAtMost(24.0)) }) {
                            Icon(Icons.Filled.Add, contentDescription = "More sleep")
                        }
                    }
                    Muted("Mood")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val mood = todayLog?.takeIf { !it.isNull("mood") }?.optInt("mood")
                        for ((value, label) in MOODS) {
                            FilterChip(selected = mood == value, onClick = { update("mood", if (mood == value) null else value) }, label = { Text(label) })
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val water = todayLog?.flag("water_ok") == true
                        val trained = todayLog?.flag("trained") == true
                        FilterChip(selected = water, onClick = { update("water_ok", !water) }, label = { Text("Drank enough water") })
                        FilterChip(selected = trained, onClick = { update("trained", !trained) }, label = { Text("Trained") })
                    }
                }
            }
            if (medications.isNotEmpty()) {
                item { SectionLabel("Medication") }
                items(medications, key = { "m" + it.optString("id") }) { med ->
                    Panel {
                        Text(med.optString("name") + (med.text("dosage")?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodyLarge)
                        val times = med.optJSONArray("schedule_times")
                        if (times != null && times.length() > 0) {
                            Muted((0 until times.length()).joinToString(" · ") { times.getString(it).take(5) })
                        }
                    }
                }
            }
            val recent = logs.filter { it.optString("log_date") < todayText }.sortedByDescending { it.optString("log_date") }.take(14)
            if (recent.isNotEmpty()) item { SectionLabel("Recent days") }
            items(recent, key = { "h" + it.optString("id") }) { log ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 8.dp)) {
                    Text(shortDate(log.optString("log_date"), today), modifier = Modifier.width(96.dp), style = MaterialTheme.typography.bodyLarge)
                    Muted(
                        listOfNotNull(
                            log.takeIf { !it.isNull("sleep_hours") }?.let { "${trim(it.optDouble("sleep_hours"))} h sleep" },
                            log.takeIf { !it.isNull("mood") }?.let { MOODS.toMap()[it.optInt("mood")] },
                            "trained".takeIf { log.flag("trained") },
                        ).joinToString(" · ").ifEmpty { "—" },
                    )
                }
            }
        }
    }
}

private fun trim(value: Double) = if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()
