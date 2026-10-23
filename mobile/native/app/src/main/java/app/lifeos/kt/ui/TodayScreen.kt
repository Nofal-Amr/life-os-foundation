package app.lifeos.kt.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.dueDetail
import app.lifeos.kt.data.isOpen
import app.lifeos.kt.data.leftToSpend
import app.lifeos.kt.data.nextAction
import app.lifeos.kt.data.prayerStatus
import app.lifeos.kt.data.prayerTimes
import app.lifeos.kt.data.spentDuring
import java.text.DateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Date

/** Today: the next action first, then prayer, money and what's due — each opens its section. */
@Composable
fun TodayScreen(open: (Section) -> Unit) {
    val app = LocalContext.current.app
    val tasks by app.tasks.tasks.collectAsState(initial = null)
    val accounts = table("accounts")
    val transactions = table("transactions")
    val prayerSettings = table("prayer_settings")?.firstOrNull()
    val prayerLogs = table("prayer_logs")
    val money = moneyFormat()
    val today = LocalDate.now()
    val todayText = today.toString()

    Column(Modifier.fillMaxSize()) {
        PageHeader("Today")
        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
            item {
                Muted(today.format(DateTimeFormatter.ofPattern("EEEE, d MMMM")))
                Spacer(Modifier.height(8.dp))
            }

            item {
                val next = tasks?.let(::nextAction)
                Panel(onClick = { open(Section.Do) }) {
                    Text("Next", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(4.dp))
                    if (next == null) {
                        Text("Nothing with a date right now", style = MaterialTheme.typography.titleMedium)
                    } else {
                        Text(next.title, style = MaterialTheme.typography.titleLarge)
                        dueDetail(next, today)?.let { Muted(it) }
                    }
                }
            }

            item {
                val times = prayerTimes(prayerSettings, today)
                val logged = prayerLogs.orEmpty().filter { it.optString("prayer_date") == todayText }
                Panel(onClick = { open(Section.Spirit) }) {
                    Text("Prayer", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    val now = Date()
                    val upcoming = times?.firstOrNull { it.at.after(now) }
                    when {
                        times == null -> Text("Set your place in Spirit settings on the website", style = MaterialTheme.typography.titleMedium)
                        upcoming != null -> Text(
                            "${upcoming.label} at ${DateFormat.getTimeInstance(DateFormat.SHORT).format(upcoming.at)}",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        else -> Text("Isha has passed", style = MaterialTheme.typography.titleMedium)
                    }
                    val prayed = logged.count { prayerStatus(it).let { s -> s != null && s != "missed" } && it.optString("prayer_name") in FIVE }
                    Muted("$prayed of 5 logged today")
                }
            }

            item {
                Panel(onClick = { open(Section.Money) }) {
                    Text("Money", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    if (accounts == null || transactions == null) {
                        Muted("…")
                    } else {
                        Text("${money(leftToSpend(accounts, transactions))} left", style = MaterialTheme.typography.titleMedium)
                        Muted("Spent today ${money(spentDuring(transactions, todayText))}")
                    }
                }
            }

            item {
                val due = tasks.orEmpty()
                    .filter { it.isOpen() && it.parentTaskId == null && it.dueDate != null && it.dueDate <= todayText }
                    .sortedWith(compareBy({ it.dueDate }, { it.dueTime ?: "99" }))
                Panel(onClick = { open(Section.Do) }) {
                    Text("Due", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    if (due.isEmpty()) Text("Nothing due today", style = MaterialTheme.typography.titleMedium)
                    for (task in due.take(5)) {
                        Row {
                            Text(task.title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            dueDetail(task, today)?.let { Muted(it) }
                        }
                    }
                    if (due.size > 5) Muted("and ${due.size - 5} more")
                }
            }
        }
    }
}

private val FIVE = setOf("fajr", "dhuhr", "asr", "maghrib", "isha")
