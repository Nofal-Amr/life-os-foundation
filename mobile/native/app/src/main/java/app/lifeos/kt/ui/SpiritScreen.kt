package app.lifeos.kt.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.PRAYERS
import app.lifeos.kt.data.PRAYER_STATUSES
import app.lifeos.kt.data.prayerStatus
import app.lifeos.kt.data.prayerTimes
import java.text.DateFormat
import java.time.LocalDate
import java.util.Date
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Spirit: today's five prayers with their times; tap how each was prayed, tap again to clear. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SpiritScreen() {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    val settings = table("prayer_settings")?.firstOrNull()
    val logs = table("prayer_logs")
    val today = LocalDate.now().toString()
    val times = prayerTimes(settings, LocalDate.now())
    val clock = DateFormat.getTimeInstance(DateFormat.SHORT)

    Column(Modifier.fillMaxSize()) {
        PageHeader("Spirit")
        if (logs == null) return@Column
        val todays = logs.filter { it.optString("prayer_date") == today }.associateBy { it.optString("prayer_name") }

        fun set(prayer: String, status: String?) {
            val existing = todays[prayer]
            scope.launch {
                if (status == null) {
                    if (existing != null) rows.delete("prayer_logs", existing)
                    return@launch
                }
                val row = JSONObject((existing ?: JSONObject().put("prayer_date", today).put("prayer_name", prayer)).toString())
                    .put("status", status)
                    // Kept in step for older screens and reports, as the web app does.
                    .put("completed", status != "missed")
                    .put("on_time", if (status == "late") false else if (status == "missed") JSONObject.NULL else true)
                rows.save("prayer_logs", row)
            }
        }

        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
            if (times == null) {
                item { Panel { Muted("Prayer times show once your place is set in Spirit settings on the website.") } }
            } else {
                item { Muted(settings?.text("city")?.let { "Times for $it" } ?: "Today") }
            }
            items(PRAYERS, key = { it.first }) { (key, label) ->
                val status = prayerStatus(todays[key])
                Panel {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        times?.firstOrNull { it.key == key }?.let { Muted(clock.format(it.at)) }
                    }
                    Spacer(Modifier.height(6.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for ((value, text) in PRAYER_STATUSES) {
                            FilterChip(selected = status == value, onClick = { set(key, if (status == value) null else value) }, label = { Text(text) })
                        }
                    }
                }
            }
        }
    }
}
