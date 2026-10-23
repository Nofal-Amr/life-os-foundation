package app.lifeos.kt.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app

/** A tool from the web app's Tools menu. [native] ones work offline here; the rest open the website for now. */
private data class Tool(val key: String, val label: String, val icon: ImageVector, val native: Boolean, val path: String)

private val TOOLS = listOf(
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

@Composable
fun MoreScreen(open: (String) -> Unit) {
    val context = LocalContext.current
    val pending = pendingChanges()
    var confirmSignOut by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        PageHeader("More")
        LazyColumn(contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp)) {
            items(TOOLS, key = { it.key }) { tool ->
                Panel(onClick = { open(tool.key) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(tool.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(14.dp))
                        Text(tool.label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                        if (!tool.native) Muted("Website")
                    }
                }
            }
            item {
                Spacer(Modifier.height(16.dp))
                val email = context.app.session.current.value?.email
                if (email != null) Muted("Signed in as $email")
                TextButton(onClick = { confirmSignOut = true }) { Text("Sign out") }
            }
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = {
                Text(
                    if (pending > 0) "$pending ${if (pending == 1) "change hasn't" else "changes haven't"} reached the server yet and will be lost."
                    else "Everything is kept on the server. This phone forgets it until you sign in again.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    context.app.signOut()
                }) { Text("Sign out") }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
        )
    }
}

@Composable
fun ToolScreen(key: String, close: () -> Unit) {
    val tool = TOOLS.firstOrNull { it.key == key } ?: return
    Column(Modifier.fillMaxSize()) {
        PageHeader(tool.label) {
            IconButton(onClick = close) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
        }
        when (key) {
            "calendar" -> CalendarTool()
            "habits" -> HabitsTool()
            "notes" -> NotesTool()
            "reminders" -> RemindersTool()
            "projects" -> ProjectsTool()
            else -> WebsiteOnly(tool)
        }
    }
}

@Composable
private fun WebsiteOnly(tool: Tool) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Panel {
            Text("${tool.label} isn't in the native app yet.", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Muted("It's coming. Until then it opens on the website (needs internet).")
            Spacer(Modifier.height(12.dp))
            Button(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(WEBSITE + tool.path))) }) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Open on the website")
            }
        }
    }
}
