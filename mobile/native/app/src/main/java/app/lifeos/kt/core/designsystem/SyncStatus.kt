package app.lifeos.kt.core.designsystem

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.CloudSync
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Science
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import app.lifeos.kt.core.sync.SyncState
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.launch

/** What the top bar needs to show where the data is. Provided by the app shell. */
data class SyncStatus(val state: SyncState = SyncState(), val pending: Int = 0, val syncNow: () -> Unit = {})

val LocalSyncStatus = staticCompositionLocalOf { SyncStatus() }
val LocalSnackbar = staticCompositionLocalOf { SnackbarHostState() }

/** Says plainly where the data is: on the server, or only on this phone so far. */
fun syncLine(sync: SyncState, pending: Int): String {
    if (sync.demo) return "Demo · sample data on this phone only"
    val waiting = if (pending > 0) " · $pending ${if (pending == 1) "change" else "changes"} saved on this phone" else ""
    return when {
        sync.running -> "Syncing…"
        sync.error != null -> sync.error + waiting
        sync.offline -> "Offline$waiting"
        sync.lastSynced != null -> "Synced at " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(sync.lastSynced)) + waiting
        else -> "Not synced yet$waiting"
    }
}

/** A cloud in the top bar: done, syncing (pulsing), offline, or a problem; a count of unsent changes. Tap to sync and see details. */
@Composable
fun SyncAction() {
    val status = LocalSyncStatus.current
    val snackbar = LocalSnackbar.current
    val scope = rememberCoroutineScope()
    val haptics = rememberHaptics()
    val spin = rememberInfiniteTransition(label = "sync")
    val pulse by spin.animateFloat(0.35f, 1f, infiniteRepeatable(tween(700, easing = LinearEasing), RepeatMode.Reverse), label = "pulse")
    val sync = status.state
    IconButton(onClick = {
        haptics.tick()
        status.syncNow()
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            snackbar.showSnackbar(syncLine(sync, status.pending))
        }
    }) {
        // Demo never syncs, so a count of "unsent" changes would mean nothing there.
        BadgedBox(badge = { if (status.pending > 0 && !sync.demo) Badge { Text("${status.pending}") } }) {
            when {
                sync.demo -> Icon(Icons.Outlined.Science, "Demo", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                sync.running -> Icon(Icons.Outlined.CloudSync, "Syncing", Modifier.graphicsLayer { alpha = pulse })
                sync.error != null -> Icon(Icons.Outlined.ErrorOutline, "Sync problem", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                sync.offline -> Icon(Icons.Outlined.CloudOff, "Offline", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> Icon(Icons.Outlined.CloudDone, "Synced", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
