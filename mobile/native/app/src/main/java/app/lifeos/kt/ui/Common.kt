package app.lifeos.kt.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.SyncState
import app.lifeos.kt.data.str
import java.text.DateFormat
import java.text.NumberFormat
import java.util.Currency
import java.util.Date
import kotlinx.coroutines.flow.combine
import org.json.JSONObject

/** Rows of a synced table, live; null only while the phone's database opens. */
@Composable
fun table(name: String): List<JSONObject>? {
    val rows = LocalContext.current.app.rows
    val flow = remember(name) { rows.observe(name) }
    val value by flow.collectAsState(initial = null)
    return value
}

/** Changes saved on this phone and not yet on the server, across every table. */
@Composable
fun pendingChanges(): Int {
    val app = LocalContext.current.app
    val flow = remember { combine(app.tasks.pending, app.rows.pending) { a, b -> a + b } }
    val value by flow.collectAsState(initial = 0)
    return value
}

fun JSONObject.num(key: String): Double = if (isNull(key)) 0.0 else optDouble(key, 0.0)
fun JSONObject.text(key: String): String? = if (has(key)) str(key) else null
fun JSONObject.flag(key: String): Boolean = has(key) && !isNull(key) && optBoolean(key)

/** Money in the user's currency (Settings on the website), or a plain number without one. */
@Composable
fun moneyFormat(): (Double) -> String {
    val prefs = table("user_preferences")?.firstOrNull()
    val code = prefs?.text("currency")
    return remember(code) {
        val format = NumberFormat.getCurrencyInstance().apply {
            maximumFractionDigits = 2
            try {
                if (code != null) currency = Currency.getInstance(code)
            } catch (e: IllegalArgumentException) {
                // Unknown code: keep the phone's own.
            }
        }
        val plain = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 2 };
        { value: Double -> if (code != null) format.format(value) else plain.format(value) }
    }
}

/** Says plainly where the data is: on the server, or only on this phone so far. */
fun syncLine(sync: SyncState, pending: Int): String {
    val waiting = if (pending > 0) " · $pending saved on this phone" else ""
    return when {
        sync.running -> "Syncing…"
        sync.error != null -> sync.error + waiting
        sync.offline -> "Offline$waiting"
        sync.lastSynced != null -> "Synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(sync.lastSynced)) + waiting
        else -> "Not synced yet$waiting"
    }
}

/** The page title, with the sync line under it and actions on the right. */
@Composable
fun PageHeader(title: String, actions: @Composable RowScope.() -> Unit = {}) {
    val app = LocalContext.current.app
    val sync by app.sync.state.collectAsState()
    val pending = pendingChanges()
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 4.dp, top = 8.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            Text(syncLine(sync, pending), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        actions()
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(start = 4.dp, top = 16.dp, bottom = 6.dp),
    )
}

/** A rounded block on the page, like the web app's cards. */
@Composable
fun Panel(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(14.dp))
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(16.dp),
        content = content,
    )
}

@Composable
fun Muted(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}
