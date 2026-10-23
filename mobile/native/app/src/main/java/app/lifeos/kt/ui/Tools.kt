package app.lifeos.kt.ui

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.isOpen
import java.text.DateFormat
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Date
import kotlinx.coroutines.launch
import org.json.JSONObject

private fun localDateOf(timestamp: String?): LocalDate? = runCatching {
    OffsetDateTime.parse(timestamp).atZoneSameInstant(ZoneId.systemDefault()).toLocalDate()
}.getOrNull()

private fun clockOf(timestamp: String?): String? = runCatching {
    DateFormat.getTimeInstance(DateFormat.SHORT).format(Date.from(OffsetDateTime.parse(timestamp).toInstant()))
}.getOrNull()

/* ------------------------------- Calendar ------------------------------- */

/** The next two weeks, day by day: events, tasks due and reminders. */
@Composable
fun CalendarTool() {
    val tasks by LocalContext.current.app.tasks.tasks.collectAsState(initial = null)
    val events = table("events")
    val reminders = table("reminders")
    if (tasks == null || events == null || reminders == null) return
    val today = LocalDate.now()
    val days = (0L until 14L).map { today.plusDays(it) }

    data class Entry(val time: String?, val title: String, val kind: String)

    val byDay = days.associateWith { mutableListOf<Entry>() }
    for (event in events) {
        val day = localDateOf(event.text("start_at")) ?: continue
        byDay[day]?.add(Entry(clockOf(event.text("start_at")), event.optString("title"), "Event"))
    }
    for (task in tasks!!.filter { it.isOpen() && it.parentTaskId == null }) {
        val day = task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: continue
        byDay[if (day < today) today else day]?.add(Entry(task.dueTime?.take(5), task.title, if (day < today) "Task, late" else "Task"))
    }
    for (reminder in reminders.filter { it.isNull("done_at") || it.optString("repeat", "none") != "none" }) {
        val day = localDateOf(reminder.text("remind_at")) ?: continue
        byDay[day]?.add(Entry(clockOf(reminder.text("remind_at")), reminder.optString("title"), "Reminder"))
    }

    LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
        for (day in days) {
            val entries = byDay.getValue(day).sortedBy { it.time ?: "99" }
            item(key = day.toString()) {
                SectionLabel(
                    when (day) {
                        today -> "Today"
                        today.plusDays(1) -> "Tomorrow"
                        else -> day.format(DateTimeFormatter.ofPattern("EEEE d MMM"))
                    },
                )
                if (entries.isEmpty()) Muted("Nothing planned", Modifier.padding(start = 4.dp))
                for (entry in entries) {
                    Panel {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(entry.time ?: "—", modifier = Modifier.width(64.dp), style = MaterialTheme.typography.bodyMedium)
                            Column(Modifier.weight(1f)) {
                                Text(entry.title, style = MaterialTheme.typography.bodyLarge)
                                Muted(entry.kind)
                            }
                        }
                    }
                }
            }
        }
    }
}

/* -------------------------------- Habits -------------------------------- */

/** Active habits: tap to mark today, tap again to undo. Weekly ones show this week's count. */
@Composable
fun HabitsTool() {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    val habits = table("habits")
    val logs = table("habit_logs")
    if (habits == null || logs == null) return
    val today = LocalDate.now()
    val weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()
    val active = habits.filter { it.optBoolean("active", true) }.sortedBy { it.optString("name") }

    LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
        if (active.isEmpty()) item { Muted("No habits yet. Add them on the website for now.") }
        items(active, key = { it.optString("id") }) { habit ->
            val id = habit.optString("id")
            val todayLog = logs.firstOrNull { it.optString("habit_id") == id && it.optString("log_date") == today.toString() }
            val weekly = habit.optString("frequency") == "weekly"
            val thisWeek = logs.count { it.optString("habit_id") == id && it.optString("log_date") >= weekStart }
            Panel(onClick = {
                scope.launch {
                    if (todayLog != null) rows.delete("habit_logs", todayLog)
                    else rows.save("habit_logs", JSONObject().put("habit_id", id).put("log_date", today.toString()))
                }
            }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (todayLog != null) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                        contentDescription = if (todayLog != null) "Done today; tap to undo" else "Tap to mark today",
                        tint = if (todayLog != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(habit.optString("name"), style = MaterialTheme.typography.bodyLarge)
                        if (weekly) Muted("$thisWeek of ${habit.optInt("target", 1)} this week")
                    }
                }
            }
        }
    }
}

/* --------------------------------- Notes -------------------------------- */

@Composable
fun NotesTool() {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    val notes = table("notes") ?: return
    var editing by remember { mutableStateOf<JSONObject?>(null) }
    val shown = notes.filter { !it.flag("archived") }
        .sortedWith(compareByDescending<JSONObject> { it.flag("pinned") }.thenByDescending { it.optString("updated_at") })

    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 96.dp)) {
            if (shown.isEmpty()) item { Muted("No notes yet.") }
            items(shown, key = { it.optString("id") }) { note ->
                Panel(onClick = { editing = note }) {
                    Text(
                        (if (note.flag("pinned")) "📌 " else "") + note.optString("title").ifEmpty { "Untitled" },
                        style = MaterialTheme.typography.titleMedium,
                    )
                    note.text("body")?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        FloatingActionButton(onClick = { editing = JSONObject() }, modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp)) {
            Icon(Icons.Filled.Add, contentDescription = "New note")
        }
    }

    editing?.let { note ->
        var title by remember(note) { mutableStateOf(note.optString("title")) }
        var body by remember(note) { mutableStateOf(note.text("body") ?: "") }
        val isNew = !note.has("id")
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text(if (isNew) "New note" else "Note") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = body, onValueChange = { body = it }, label = { Text("Note") }, modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp))
                }
            },
            confirmButton = {
                TextButton(enabled = title.isNotBlank() || body.isNotBlank(), onClick = {
                    val row = JSONObject(note.toString()).put("title", title.trim()).put("body", body)
                    if (isNew) row.put("tags", org.json.JSONArray()).put("pinned", false).put("archived", false)
                    scope.launch { rows.save("notes", row) }
                    editing = null
                }) { Text("Save") }
            },
            dismissButton = {
                Row {
                    if (!isNew) {
                        TextButton(onClick = {
                            scope.launch { rows.delete("notes", note) }
                            editing = null
                        }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                    }
                    TextButton(onClick = { editing = null }) { Text("Cancel") }
                }
            },
        )
    }
}

/* ------------------------------- Reminders ------------------------------ */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RemindersTool() {
    val rows = LocalContext.current.app.rows
    val scope = rememberCoroutineScope()
    val reminders = table("reminders") ?: return
    var adding by remember { mutableStateOf(false) }
    // A repeating reminder marked done is only done for that time; it stays.
    val open = reminders.filter { it.isNull("done_at") || it.optString("repeat", "none") != "none" }.sortedBy { it.optString("remind_at") }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 96.dp)) {
            item { Muted("The website's reminders. This app doesn't ring for them yet.", Modifier.padding(start = 4.dp, bottom = 8.dp)) }
            if (open.isEmpty()) item { Muted("No reminders waiting.", Modifier.padding(start = 4.dp)) }
            items(open, key = { it.optString("id") }) { reminder ->
                Panel(onClick = {
                    scope.launch { rows.save("reminders", JSONObject(reminder.toString()).put("done_at", Instant.now().toString())) }
                }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Circle, contentDescription = "Tap to mark done", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(reminder.optString("title"), style = MaterialTheme.typography.bodyLarge)
                            val day = localDateOf(reminder.text("remind_at"))
                            Muted(listOfNotNull(day?.let { shortDate(it.toString(), LocalDate.now()) }, clockOf(reminder.text("remind_at"))).joinToString(" · "))
                        }
                    }
                }
            }
        }
        FloatingActionButton(onClick = { adding = true }, modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp)) {
            Icon(Icons.Filled.Add, contentDescription = "New reminder")
        }
    }

    if (adding) {
        var title by remember { mutableStateOf("") }
        val now = LocalDateTime.now()
        val choices = listOf(
            "In 1 hour" to now.plusHours(1),
            "Tonight 20:00" to now.toLocalDate().atTime(20, 0),
            "Tomorrow 09:00" to now.toLocalDate().plusDays(1).atTime(9, 0),
        ).filter { it.second.isAfter(now) }
        var at by remember { mutableStateOf(choices.first().second) }
        AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text("New reminder") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Remind me to…") }, singleLine = true)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for ((label, time) in choices) FilterChip(selected = at == time, onClick = { at = time }, label = { Text(label) })
                    }
                }
            },
            confirmButton = {
                TextButton(enabled = title.isNotBlank(), onClick = {
                    val row = JSONObject()
                        .put("title", title.trim())
                        .put("remind_at", at.atZone(ZoneId.systemDefault()).toOffsetDateTime().toString())
                        .put("repeat", "none")
                    scope.launch { rows.save("reminders", row) }
                    adding = false
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { adding = false }) { Text("Cancel") } },
        )
    }
}

/* --------------------------- Projects & goals --------------------------- */

@Composable
fun ProjectsTool() {
    val projects = table("projects")
    val goals = table("goals")
    if (projects == null || goals == null) return
    val openProjects = projects.filter { it.optString("status") !in setOf("completed", "archived", "cancelled") }.sortedBy { it.optString("name") }
    val openGoals = goals.filter { it.optString("status") !in setOf("completed", "archived") }.sortedBy { it.optString("name") }

    LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
        item { SectionLabel(if (openProjects.isEmpty()) "No open projects" else "Projects") }
        items(openProjects, key = { "p" + it.optString("id") }) { project ->
            Panel {
                Text(project.optString("name"), style = MaterialTheme.typography.bodyLarge)
                Muted(listOfNotNull(project.optString("status").replace('_', ' ').replaceFirstChar { it.uppercase() }, project.text("due_date")?.let { "due ${shortDate(it, LocalDate.now())}" }).joinToString(" · "))
            }
        }
        item { SectionLabel(if (openGoals.isEmpty()) "No open goals" else "Goals") }
        items(openGoals, key = { "g" + it.optString("id") }) { goal ->
            Panel {
                Text(goal.optString("name"), style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(progress = { (goal.optDouble("progress", 0.0) / 100.0).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                goal.text("target_date")?.let { Muted("by ${shortDate(it, LocalDate.now())}", Modifier.padding(top = 4.dp)) }
            }
        }
    }
}
