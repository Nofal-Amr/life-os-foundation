package app.lifeos.kt.feature.calendar

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.lifeos.kt.core.common.instantOf
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.PickDate
import app.lifeos.kt.core.designsystem.PickTime
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.CalendarEvent
import app.lifeos.kt.data.Country
import app.lifeos.kt.data.logic.Holiday
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.tasks.EditorSheet
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** An event being added or edited: start and end in local time. */
data class EventDraft(val event: CalendarEvent?, val start: LocalDateTime, val end: LocalDateTime?) {
    companion object {
        fun at(start: LocalDateTime) = EventDraft(null, start, start.plusHours(1))
        fun of(event: CalendarEvent): EventDraft {
            val zone = ZoneId.systemDefault()
            val start = instantOf(event.startAt)?.atZone(zone)?.toLocalDateTime() ?: LocalDateTime.now()
            return EventDraft(event, start, instantOf(event.endAt)?.atZone(zone)?.toLocalDateTime())
        }
    }
}

/** Title, when it starts and ends, and a description. Ending before it starts isn't allowed. */
@Composable
internal fun EventEditor(draft: EventDraft, model: CalendarViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var title by remember { mutableStateOf(draft.event?.title.orEmpty()) }
    var description by remember { mutableStateOf(draft.event?.description.orEmpty()) }
    var start by remember { mutableStateOf(draft.start) }
    var end by remember { mutableStateOf(draft.end) }
    var picking by remember { mutableStateOf<String?>(null) }
    val zone = ZoneId.systemDefault()
    val day = DateTimeFormatter.ofPattern("EEE d MMM")
    val clock = DateTimeFormatter.ofPattern("HH:mm")

    EditorSheet(
        title = if (draft.event == null) "New event" else "Edit event",
        close = close,
        onSave = {
            if (title.isBlank() || (end != null && end!!.isBefore(start))) { haptics.reject(); false } else {
                haptics.confirm()
                model.save(
                    (draft.event ?: CalendarEvent(newId(), title, startAt = "")).copy(
                        title = title.trim(),
                        description = description.trim().ifEmpty { null },
                        startAt = start.atZone(zone).toInstant().toString(),
                        endAt = end?.atZone(zone)?.toInstant()?.toString(),
                    ),
                )
                true
            }
        },
        delete = draft.event?.let { e -> { haptics.confirm(); model.delete(e); close(); undo("Event deleted") { model.save(e) } } },
    ) {
        OutlinedTextField(title, { title = it }, label = { Text("Title") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Eyebrow("Starts")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectChip(true, start.format(day), { picking = "start-date" }, leadingIcon = Icons.Outlined.CalendarMonth)
            SelectChip(true, start.format(clock), { picking = "start-time" }, leadingIcon = Icons.Outlined.Schedule)
        }
        Eyebrow("Ends")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            val e = end
            if (e == null) {
                SelectChip(false, "Add an end", { end = start.plusHours(1) }, leadingIcon = Icons.Outlined.Schedule)
            } else {
                SelectChip(true, e.format(day), { picking = "end-date" }, leadingIcon = Icons.Outlined.CalendarMonth)
                SelectChip(true, e.format(clock), { picking = "end-time" }, leadingIcon = Icons.Outlined.Schedule)
                TextButton(onClick = { end = null }) { Text("No end") }
            }
        }
        if (end != null && end!!.isBefore(start)) Text("It ends before it starts.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        OutlinedTextField(description, { description = it }, label = { Text("Description") }, minLines = 2, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
    }
    when (picking) {
        "start-date" -> PickDate(start.toLocalDate(), dismiss = { picking = null }) { d ->
            // Moving the start keeps the event's length.
            val length = end?.let { java.time.Duration.between(start, it) }
            start = d.atTime(start.toLocalTime())
            end = length?.let { start.plus(it) }
        }
        "start-time" -> PickTime(start.toLocalTime(), dismiss = { picking = null }) { t ->
            val length = end?.let { java.time.Duration.between(start, it) }
            start = start.toLocalDate().atTime(t)
            end = length?.let { start.plus(it) }
        }
        "end-date" -> PickDate(end!!.toLocalDate(), dismiss = { picking = null }) { d -> end = d.atTime(end!!.toLocalTime()) }
        "end-time" -> PickTime(end!!.toLocalTime(), dismiss = { picking = null }) { t -> end = end!!.toLocalDate().atTime(t) }
    }
}

/** The web's Holidays card: a country's public holidays, Islamic occasions, and hiding any day you don't want. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun HolidaySetupSheet(model: CalendarViewModel, close: () -> Unit) {
    val haptics = rememberHaptics()
    val state by model.state.collectAsState()
    val settings = state?.holidaySettings ?: return
    var countries by remember { mutableStateOf<List<Country>?>(null) }
    var query by remember { mutableStateOf("") }
    var upcoming by remember { mutableStateOf<List<Holiday>>(emptyList()) }
    LaunchedEffect(Unit) { countries = runCatching { model.countries() }.getOrDefault(emptyList()) }
    LaunchedEffect(settings) { upcoming = runCatching { model.allHolidays() }.getOrDefault(emptyList()).filter { !it.date.isBefore(LocalDate.now()) }.take(10) }

    EditorSheet(title = "Holidays", close = close, onSave = { true }) {
        Muted("Shown on the Calendar. Public holidays come from Nager.Date (only the country and year are sent); Islamic occasions are worked out on this phone and may move a day with the moon sighting.", style = MaterialTheme.typography.bodySmall)
        Row(
            Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).clickable(role = Role.Switch) { haptics.tick(); model.updateHolidays { it.copy(islamic = !it.islamic) } }.padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Islamic occasions", style = MaterialTheme.typography.bodyLarge)
                Muted("Ramadan, the two Eids, Arafah, Ashura and more", style = MaterialTheme.typography.bodySmall)
            }
            Switch(settings.islamic, onCheckedChange = null)
        }
        Eyebrow("Public holidays")
        val list = countries
        when {
            list == null -> Muted("Loading countries…", style = MaterialTheme.typography.bodySmall)
            list.isEmpty() -> Muted("Couldn't load the list of countries. Check the connection and open this again.", style = MaterialTheme.typography.bodySmall)
            else -> {
                OutlinedTextField(query, { query = it }, label = { Text("Find a country") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                val current = list.firstOrNull { it.countryCode == settings.country }
                val shown = (listOfNotNull(current) + list.filter { query.isNotBlank() && it.name.contains(query.trim(), ignoreCase = true) }.take(8)).distinct()
                androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    SelectChip(settings.country == null, "None", { haptics.tick(); model.updateHolidays { it.copy(country = null) } })
                    for (c in shown) SelectChip(settings.country == c.countryCode, c.name, { haptics.tick(); model.updateHolidays { it.copy(country = c.countryCode) } })
                }
            }
        }
        if (upcoming.isNotEmpty()) {
            Eyebrow("Coming up · tap to hide or show")
            for (h in upcoming) {
                val key = "${h.date}|${h.name}"
                val shown = key !in settings.hidden
                Row(
                    Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).clickable { haptics.tick(); model.updateHolidays { it.copy(hidden = if (shown) it.hidden + key else it.hidden - key) } }.padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(h.date.format(DateTimeFormatter.ofPattern("d MMM")), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(64.dp))
                    Column(Modifier.weight(1f)) {
                        Text(h.name, style = MaterialTheme.typography.bodyMedium, color = if (shown) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                        h.localName?.let { Muted(it, style = MaterialTheme.typography.bodySmall) }
                    }
                    Muted(if (shown) "Shown" else "Hidden", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        Spacer(Modifier.padding(2.dp))
    }
}
