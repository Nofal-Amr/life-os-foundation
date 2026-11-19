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
import androidx.compose.foundation.layout.size
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
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.outlined.Settings
import app.lifeos.kt.data.moduleOn
import kotlinx.coroutines.flow.map
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.syncLine
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** A tool from the web app's Tools menu. [native] ones work offline here; the rest open the website for now. */
data class Tool(val key: String, val label: String, val icon: ImageVector, val native: Boolean, val path: String, val module: String? = null)

val TOOLS = listOf(
    Tool("calendar", "Calendar", Icons.Outlined.CalendarMonth, true, "/calendar", "calendar"),
    Tool("notes", "Notes", Icons.Outlined.EditNote, true, "/notes", "notes"),
    Tool("reminders", "Reminders", Icons.Outlined.Alarm, true, "/reminders"),
    Tool("work", "Work", Icons.Outlined.Work, false, "/work", "work"),
    Tool("study", "Study", Icons.Outlined.School, false, "/study", "study"),
    Tool("messages", "Messages", Icons.Outlined.ChatBubbleOutline, false, "/messages"),
    Tool("insights", "Insights", Icons.Outlined.AutoGraph, false, "/insights"),
    Tool("together", "Together", Icons.Outlined.Groups, false, "/together"),
    Tool("review", "Review", Icons.Outlined.NightsStay, true, "/review"),
)

private const val WEBSITE = "https://lifeos0.vercel.app"

@HiltViewModel
class MoreViewModel @Inject constructor(prefs: app.lifeos.kt.data.PreferencesRepository) : ViewModel() {
    /** The areas that are on (Settings → Areas); tools for areas that are off are left out. */
    val enabled = prefs.preferences.map { it?.enabledModules }.stateIn(viewModelScope, SharingStarted.Eagerly, null)
}

@Composable
fun MoreScreen(open: (String) -> Unit, model: MoreViewModel = hiltViewModel()) {
    val sync = LocalSyncStatus.current
    val enabled by model.enabled.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LifePage(title = "More", actions = { SyncAction(); IconButton(onClick = { open("settings") }) { Icon(Icons.Outlined.Settings, "Settings") } }) {
        item { SectionHeader("Tools") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                for (tool in TOOLS.filter { it.native && (it.module == null || moduleOn(enabled, it.module)) }) {
                    ToolRow(tool) { open(tool.key) }
                }
            }
        }
        // Said once, as a heading, instead of "Website" on every row; a tap opens the page
        // straight away (no in-between screen that only holds a button).
        item { SectionHeader("On the website") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                for (tool in TOOLS.filter { !it.native && (it.module == null || moduleOn(enabled, it.module)) }) {
                    ToolRow(tool) { openWebsite(context, tool) }
                }
                Muted(
                    "These open in your browser and need internet. They're coming to the app.",
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 10.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        item { SectionHeader("Settings") }
        item {
            LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                ToolRow(Tool("settings", "Settings", Icons.Outlined.Settings, true, "/settings")) { open("settings") }
            }
        }
        item { Muted(syncLine(sync.state, sync.pending), Modifier.padding(horizontal = 4.dp, vertical = 8.dp), style = MaterialTheme.typography.bodySmall) }
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
        // In the app: a chevron. On the website: the "opens outside" arrow, said for screen readers too.
        if (tool.native) Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        else Icon(Icons.AutoMirrored.Filled.OpenInNew, "Opens on the website", Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}


@Composable
fun ToolScreen(key: String, close: () -> Unit, openTarget: (app.lifeos.kt.data.logic.Target) -> Unit = {}) {
    if (key == "settings") return app.lifeos.kt.feature.settings.SettingsScreen({ IconButton(onClick = close) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } })
    val tool = TOOLS.firstOrNull { it.key == key } ?: return
    val back: @Composable () -> Unit = { IconButton(onClick = close) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } }
    when (key) {
        "calendar" -> app.lifeos.kt.feature.calendar.CalendarScreen(back, openTarget)
        "notes" -> app.lifeos.kt.feature.notes.NotesScreen(back)
        "reminders" -> RemindersTool(back)
        "review" -> app.lifeos.kt.feature.review.ReviewScreen(back)
        "settings" -> app.lifeos.kt.feature.settings.SettingsScreen(back)
        else -> WebsiteOnly(tool, back)
    }
}

/** Opens a website-only tool in the browser. */
internal fun openWebsite(context: android.content.Context, tool: Tool) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(WEBSITE + tool.path))) }
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
