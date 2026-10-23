package app.lifeos.kt.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.lifeos.kt.app
import app.lifeos.kt.data.SyncState
import app.lifeos.kt.data.TaskEntity
import app.lifeos.kt.data.TaskGroup
import app.lifeos.kt.data.dueDetail
import app.lifeos.kt.data.groupTasks
import app.lifeos.kt.data.isOpen
import java.text.DateFormat
import java.time.LocalDate
import java.util.Date
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen() {
    val context = LocalContext.current
    val repo = context.app.tasks
    val scope = rememberCoroutineScope()
    // Null only for the first moment, while the phone's database opens.
    val tasks by repo.tasks.collectAsState(initial = null)
    val today = LocalDate.now()
    var deleting by remember { mutableStateOf<TaskEntity?>(null) }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().imePadding()) {
            PageHeader("Do")
            PullToRefreshBox(
                isRefreshing = context.app.sync.state.collectAsState().value.running,
                onRefresh = { context.app.sync.request() },
                modifier = Modifier.weight(1f),
            ) {
                val list = tasks
                if (list != null) {
                    val groups = groupTasks(list, today)
                    if (groups.isEmpty()) {
                        Text(
                            "Nothing here yet. Add a task below.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(24.dp),
                        )
                    }
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 16.dp)) {
                        for ((group, rows) in groups) {
                            item(key = group.name) { GroupLabel(group, rows.size) }
                            items(rows, key = { it.id }) { task ->
                                TaskRow(
                                    task = task,
                                    detail = dueDetail(task, today),
                                    late = group == TaskGroup.Late,
                                    onToggle = { scope.launch { repo.setDone(task, task.isOpen()) } },
                                    onLongPress = { deleting = task },
                                )
                            }
                        }
                    }
                }
            }
            AddBar(onAdd = { title, dueToday ->
                scope.launch { repo.add(title, if (dueToday) today.toString() else null) }
            })
        }
    }

    deleting?.let { task ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete this task?") },
            text = { Text(task.title) },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch { repo.delete(task) }
                    deleting = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Keep") } },
        )
    }
}

@Composable
private fun GroupLabel(group: TaskGroup, count: Int) {
    Text(
        "${group.label} · $count",
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp, top = 16.dp, bottom = 6.dp),
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TaskRow(task: TaskEntity, detail: String?, late: Boolean, onToggle: () -> Unit, onLongPress: () -> Unit) {
    val done = !task.isOpen()
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp)
            .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(12.dp))
            .combinedClickable(onClick = onToggle, onLongClick = onLongPress, onLongClickLabel = "Delete")
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (done) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
            contentDescription = if (done) "Done; tap to undo" else "Tap to finish",
            tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                task.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (done) TextDecoration.LineThrough else null,
                color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
            detail?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (late) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (task.dirty) {
            // Saved here, not on the server yet.
            Box(Modifier.size(6.dp).background(MaterialTheme.colorScheme.onSurfaceVariant, RoundedCornerShape(3.dp)))
        }
    }
}

@Composable
private fun AddBar(onAdd: (title: String, dueToday: Boolean) -> Unit) {
    var title by remember { mutableStateOf("") }
    var dueToday by remember { mutableStateOf(true) }
    fun submit() {
        if (title.isBlank()) return
        onAdd(title, dueToday)
        title = ""
    }
    Surface(color = MaterialTheme.colorScheme.surfaceContainer, tonalElevation = 2.dp) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    placeholder = { Text("Add a task") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = ::submit, enabled = title.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Add")
                }
            }
            FilterChip(
                selected = dueToday,
                onClick = { dueToday = !dueToday },
                label = { Text(if (dueToday) "Due today" else "No date") },
            )
        }
    }
}
