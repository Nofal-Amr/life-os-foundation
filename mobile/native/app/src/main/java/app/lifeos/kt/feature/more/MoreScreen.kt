package app.lifeos.kt.feature.more

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Alarm
import androidx.compose.material.icons.outlined.AutoGraph
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.NightsStay
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.datastore.AppSettings
import app.lifeos.kt.core.datastore.SessionState
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.syncLine
import app.lifeos.kt.data.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** A tool from the web app's Tools menu. [native] ones work offline here; the rest open the website for now. */
data class Tool(val key: String, val label: String, val icon: ImageVector, val native: Boolean, val path: String)

val TOOLS = listOf(
    Tool("calendar", "Calendar", Icons.Outlined.CalendarMonth, true, "/calendar"),
    Tool("habits", "Habits", Icons.Outlined.Repeat, true, "/habits"),
    Tool("notes", "Notes", Icons.Outlined.EditNote, true, "/notes"),
    Tool("reminders", "Reminders", Icons.Outlined.Alarm, true, "/reminders"),
    Tool("projects", "Projects & goals", Icons.Outlined.Flag, true, "/projects"),
    Tool("work", "Work", Icons.Outlined.Work, false, "/work"),
    Tool("study", "Study", Icons.Outlined.School, false, "/study"),
    Tool("messages", "Messages", Icons.Outlined.ChatBubbleOutline, false, "/messages"),
    Tool("insights", "Insights", Icons.Outlined.AutoGraph, false, "/insights"),
    Tool("together", "Together", Icons.Outlined.Groups, false, "/together"),
    Tool("review", "Daily review", Icons.Outlined.NightsStay, false, "/review"),
)

private const val WEBSITE = "https://lifeos0.vercel.app"

@HiltViewModel
class MoreViewModel @Inject constructor(private val settings: AppSettings, private val account: AccountRepository) : ViewModel() {
    val haptics = settings.haptics.stateIn(viewModelScope, SharingStarted.Eagerly, true)
    val dynamicColor = settings.dynamicColor.stateIn(viewModelScope, SharingStarted.Eagerly, false)
    val email: String? get() = (account.state.value as? SessionState.SignedIn)?.session?.email

    fun setHaptics(on: Boolean) = viewModelScope.launch { settings.setHaptics(on) }
    fun setDynamicColor(on: Boolean) = viewModelScope.launch { settings.setDynamicColor(on) }
    fun signOut() = viewModelScope.launch { account.signOut() }
}

@Composable
fun MoreScreen(open: (String) -> Unit, model: MoreViewModel = hiltViewModel()) {
    val sync = LocalSyncStatus.current
    val haptics by model.haptics.collectAsStateWithLifecycle()
    val dynamicColor by model.dynamicColor.collectAsStateWithLifecycle()
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }

    LifePage(title = "More", actions = { SyncAction() }) {
        item { SectionHeader("Tools") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                for (tool in TOOLS) {
                    ToolRow(tool) { open(tool.key) }
                }
            }
        }
        item { SectionHeader("This phone") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("Haptic feedback", "A light touch when you finish, log or swipe.", haptics, model::setHaptics)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    SwitchRow("Wallpaper colours", "Use your wallpaper's colours instead of Life OS's.", dynamicColor, model::setDynamicColor)
                }
            }
        }
        item { SectionHeader("Account") }
        item {
            LifeCard {
                model.email?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
                Muted(syncLine(sync.state, sync.pending), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = { confirmSignOut = true }, contentPadding = PaddingValues(0.dp)) { Text("Sign out") }
            }
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = {
                Text(
                    if (sync.pending > 0) "${sync.pending} ${if (sync.pending == 1) "change hasn't" else "changes haven't"} reached the server yet and will be lost."
                    else "Everything is on the server. This phone forgets it until you sign in again.",
                )
            },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; model.signOut() }) { Text("Sign out") } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ToolRow(tool: Tool, onClick: () -> Unit) {
    val haptics = rememberHaptics()
    TextButton(
        onClick = { haptics.tick(); onClick() },
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
    ) {
        IconBadge(tool.icon, size = 34.dp)
        Spacer(Modifier.width(14.dp))
        Text(tool.label, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
        if (!tool.native) Muted("Website", style = MaterialTheme.typography.bodySmall)
        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SwitchRow(title: String, caption: String, on: Boolean, set: (Boolean) -> Unit) {
    val haptics = rememberHaptics()
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Muted(caption, style = MaterialTheme.typography.bodySmall)
        }
        Switch(checked = on, onCheckedChange = { haptics.tick(); set(it) })
    }
}

@Composable
fun ToolScreen(key: String, close: () -> Unit) {
    val tool = TOOLS.firstOrNull { it.key == key } ?: return
    val back: @Composable () -> Unit = { IconButton(onClick = close) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } }
    when (key) {
        "calendar" -> CalendarTool(back)
        "habits" -> HabitsTool(back)
        "notes" -> app.lifeos.kt.feature.notes.NotesScreen(back)
        "reminders" -> RemindersTool(back)
        "projects" -> ProjectsTool(back)
        else -> WebsiteOnly(tool, back)
    }
}

@Composable
private fun WebsiteOnly(tool: Tool, back: @Composable () -> Unit) {
    val context = LocalContext.current
    LifePage(title = tool.label, navigationIcon = back) {
        item {
            LifeCard {
                IconBadge(tool.icon, size = 44.dp)
                Spacer(Modifier.height(12.dp))
                Text("${tool.label} is coming to the app", style = MaterialTheme.typography.titleMedium)
                Muted("Until then it opens on the website (needs internet).")
                Spacer(Modifier.height(14.dp))
                Button(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(WEBSITE + tool.path))) }, shape = MaterialTheme.shapes.medium) {
                    Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Open on the website")
                }
            }
        }
    }
}
