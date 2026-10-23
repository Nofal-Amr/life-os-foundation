package app.lifeos.kt.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.common.friendlyDate
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import kotlinx.coroutines.launch

/**
 * "Done. Undo" for ten seconds: long enough to notice and reach. Returns a
 * function that shows the message and runs [undo] if it's tapped.
 */
@Composable
fun rememberUndo(): (message: String, undo: () -> Unit) -> Unit {
    val snackbar = LocalSnackbar.current
    val scope = rememberCoroutineScope()
    val haptics = rememberHaptics()
    return remember(snackbar, scope) {
        { message, undo ->
            scope.launch {
                snackbar.currentSnackbarData?.dismiss()
                val result = snackbar.showSnackbar(message, actionLabel = "Undo", withDismissAction = true, duration = SnackbarDuration.Long)
                if (result == SnackbarResult.ActionPerformed) {
                    haptics.tick()
                    undo()
                }
            }
        }
    }
}

/** A plain message, e.g. "Saved on this phone". */
@Composable
fun rememberToast(): (String) -> Unit {
    val snackbar = LocalSnackbar.current
    val scope = rememberCoroutineScope()
    return remember(snackbar, scope) {
        { message -> scope.launch { snackbar.currentSnackbarData?.dismiss(); snackbar.showSnackbar(message) } }
    }
}

/**
 * Quick date choices as chips (Today, Tomorrow, Next week, No date) plus
 * "Pick a date…" for anything else. [value] is yyyy-MM-dd or null.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DateChoice(value: String?, onChange: (String?) -> Unit, allowNone: Boolean = true) {
    val today = LocalDate.now()
    val quick = listOf("Today" to today, "Tomorrow" to today.plusDays(1), "Next week" to today.plusWeeks(1))
    var picking by remember { mutableStateOf(false) }
    val custom = value != null && quick.none { it.second.toString() == value }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        for ((label, date) in quick) SelectChip(value == date.toString(), label, { onChange(date.toString()) })
        if (allowNone) SelectChip(value == null, "No date", { onChange(null) })
        SelectChip(custom, if (custom) friendlyDate(value) ?: value!! else "Pick a date…", { picking = true }, leadingIcon = Icons.Outlined.CalendarMonth)
    }
    if (picking) {
        PickDate(initial = value?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: today, dismiss = { picking = false }) { onChange(it.toString()) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PickDate(initial: LocalDate, dismiss: () -> Unit, pick: (LocalDate) -> Unit) {
    val haptics = rememberHaptics()
    val state = rememberDatePickerState(initialSelectedDateMillis = initial.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli())
    DatePickerDialog(
        onDismissRequest = dismiss,
        confirmButton = {
            TextButton(onClick = {
                state.selectedDateMillis?.let { pick(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                haptics.tick()
                dismiss()
            }) { Text("Choose") }
        },
        dismissButton = { TextButton(onClick = dismiss) { Text("Cancel") } },
    ) { DatePicker(state = state) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PickTime(initial: LocalTime, dismiss: () -> Unit, pick: (LocalTime) -> Unit) {
    val haptics = rememberHaptics()
    val is24 = android.text.format.DateFormat.is24HourFormat(LocalContext.current)
    val state = rememberTimePickerState(initial.hour, initial.minute, is24)
    AlertDialog(
        onDismissRequest = dismiss,
        confirmButton = {
            TextButton(onClick = { haptics.tick(); pick(LocalTime.of(state.hour, state.minute)); dismiss() }) { Text("Choose") }
        },
        dismissButton = { TextButton(onClick = dismiss) { Text("Cancel") } },
        text = { Column { TimePicker(state = state) } },
    )
}
