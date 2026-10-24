package app.lifeos.kt.feature.calendar

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.EventNote
import androidx.compose.material.icons.outlined.Celebration
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.EntityIcon
import app.lifeos.kt.core.designsystem.LifeTheme
import app.lifeos.kt.core.designsystem.LocalStatusBarHandled
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.Numbers
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.data.logic.CalItem
import app.lifeos.kt.data.logic.Source
import app.lifeos.kt.data.logic.Target
import app.lifeos.kt.data.logic.layoutTimed
import app.lifeos.kt.data.logic.monthGrid
import app.lifeos.kt.data.logic.weekDays
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import kotlin.math.abs

private val HOUR: Dp = 56.dp

@Composable
internal fun sourceColor(source: Source): Color {
    val chart = LifeTheme.colors.chart
    return when (source) {
        Source.Events -> chart[0]
        Source.Tasks -> chart[1]
        Source.Projects, Source.Goals -> chart[3]
        Source.Costs -> chart[4]
        Source.Health -> MaterialTheme.colorScheme.primary
        Source.Holidays -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

/**
 * Calendar: everything with a date (events, tasks, projects, goals, costs,
 * health logs, holidays) in Day, Week, Month or Schedule. Native touches:
 * swipe left or right to move through time, tap an empty hour to add an
 * event there, and every move ticks softly.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(back: @Composable () -> Unit, open: (Target) -> Unit, model: CalendarViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val view by model.view.collectAsStateWithLifecycle()
    val hidden by model.hidden.collectAsStateWithLifecycle()
    val showPrayers by model.showPrayers.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val today = LocalDate.now()
    var cursor by rememberSaveable { mutableStateOf(today.toString()) }
    var selected by rememberSaveable { mutableStateOf(today.toString()) }
    var editing by remember { mutableStateOf<EventDraft?>(null) }
    var holidaySetup by rememberSaveable { mutableStateOf(false) }
    val at = LocalDate.parse(cursor)
    var direction by remember { mutableStateOf(1) }

    fun step(by: Int) {
        haptics.tick()
        direction = by
        cursor = when (view) {
            CalView.Month -> YearMonth.from(at).plusMonths(by.toLong()).atDay(1)
            CalView.Week -> at.plusWeeks(by.toLong())
            CalView.Day -> at.plusDays(by.toLong())
            CalView.Schedule -> at.plusDays(30L * by)
        }.toString()
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            val top = if (LocalStatusBarHandled.current) Modifier else Modifier.statusBarsPadding()
            Column(top.padding(top = 4.dp)) {
                Box(Modifier.padding(start = 4.dp)) { back() }
                Text("Calendar", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(horizontal = 20.dp))
            }
            val s = state
            if (s == null) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { repeat(4) { Skeleton(height = 80.dp) } }
                return@Column
            }
            val week = weekDays(at, s.weekStart)
            // Toolbar: Today, back and forward, the range.
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { haptics.tick(); cursor = today.toString(); selected = today.toString() }, shape = MaterialTheme.shapes.medium, contentPadding = PaddingValues(horizontal = 14.dp)) { Text("Today") }
                IconButton(onClick = { step(-1) }) { Icon(Icons.Outlined.ChevronLeft, "Previous") }
                IconButton(onClick = { step(1) }) { Icon(Icons.Outlined.ChevronRight, "Next") }
                Text(
                    when (view) {
                        CalView.Month -> at.format(DateTimeFormatter.ofPattern("MMMM yyyy"))
                        CalView.Week -> "${week.first().format(DateTimeFormatter.ofPattern("d MMM"))} – ${week.last().format(DateTimeFormatter.ofPattern("d MMM"))}"
                        CalView.Day -> at.format(DateTimeFormatter.ofPattern("EEEE d MMMM"))
                        CalView.Schedule -> "${at.format(DateTimeFormatter.ofPattern("d MMM"))} – ${at.plusDays(29).format(DateTimeFormatter.ofPattern("d MMM"))}"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                CalView.entries.forEachIndexed { index, option ->
                    SegmentedButton(selected = view == option, onClick = { haptics.tick(); model.setView(option) }, shape = SegmentedButtonDefaults.itemShape(index, CalView.entries.size), icon = {}) {
                        Text(option.label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
                    }
                }
            }
            // What's shown.
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (source in Source.entries) {
                    SourceChip(source.label, sourceColor(source), source !in hidden, dashed = false) { haptics.tick(); model.toggle(source) }
                }
                if (s.prayers?.latitude != null) SourceChip("Prayer times", MaterialTheme.colorScheme.primary, showPrayers, dashed = true) { haptics.tick(); model.togglePrayers() }
                SourceChip("Holiday setup", MaterialTheme.colorScheme.onSurfaceVariant, true, dashed = false, icon = true) { haptics.tick(); holidaySetup = true }
            }
            val swipe = Modifier.pointerInput(view, cursor) {
                var total = 0f
                detectHorizontalDragGestures(onDragStart = { total = 0f }, onDragEnd = { if (abs(total) > 120) step(if (total < 0) 1 else -1) }) { _, drag -> total += drag }
            }
            AnimatedContent(
                targetState = view to cursor,
                transitionSpec = {
                    val d = direction
                    (slideInHorizontally(tween(220)) { it / 6 * d } + fadeIn(tween(220))) togetherWith (slideOutHorizontally(tween(160)) { -it / 8 * d } + fadeOut(tween(120)))
                },
                modifier = Modifier.weight(1f),
                label = "range",
            ) { (v, c) ->
                val day = LocalDate.parse(c)
                when (v) {
                    CalView.Month -> MonthView(s, day, LocalDate.parse(selected), hidden, swipe, today, pick = { haptics.tick(); selected = it.toString() }, openDay = { cursor = it.toString(); model.setView(CalView.Day) }, open = { item -> haptics.tick(); if (item.target is Target.Event) editing = EventDraft.of(item.target.event) else open(item.target) })
                    CalView.Week, CalView.Day -> TimeGrid(
                        days = if (v == CalView.Week) weekDays(day, s.weekStart) else listOf(day),
                        today = today,
                        items = { s.on(it, hidden) },
                        marks = { if (showPrayers) s.prayerMarks(it) else emptyList() },
                        swipe = swipe,
                        onSlot = { slot -> haptics.tick(); editing = EventDraft.at(slot) },
                        onItem = { item -> haptics.tick(); if (item.target is Target.Event) editing = EventDraft.of(item.target.event) else open(item.target) },
                        onDay = { d -> haptics.tick(); cursor = d.toString(); model.setView(CalView.Day) },
                    )
                    CalView.Schedule -> ScheduleView(s, day, hidden, swipe, today, onNew = { editing = EventDraft.at(day.atTime(9, 0)) }) { item ->
                        haptics.tick()
                        if (item.target is Target.Event) editing = EventDraft.of(item.target.event) else open(item.target)
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { haptics.tick(); editing = EventDraft.at((if (view == CalView.Month) LocalDate.parse(selected) else at).atTime(9, 0)) },
            icon = { Icon(Icons.Filled.Add, null) },
            text = { Text("Event") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
        )
    }
    editing?.let { draft -> EventEditor(draft, model, close = { editing = null }) }
    if (holidaySetup) HolidaySetupSheet(model, close = { holidaySetup = false })
}

@Composable
private fun SourceChip(label: String, color: Color, on: Boolean, dashed: Boolean, icon: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier
            .clip(shape)
            .background(if (on) MaterialTheme.colorScheme.surfaceContainer else Color.Transparent)
            .border(1.dp, if (on) MaterialTheme.colorScheme.outlineVariant else Color.Transparent, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon) Icon(Icons.Outlined.Celebration, null, Modifier.size(14.dp), tint = color)
        else if (dashed) Box(Modifier.size(9.dp).border(1.5.dp, color, CircleShape))
        else Box(Modifier.size(9.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = if (on) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
    }
}

/* --------------------------------- Month --------------------------------- */

@Composable
private fun MonthView(s: CalendarState, month: LocalDate, selected: LocalDate, hidden: Set<Source>, swipe: Modifier, today: LocalDate, pick: (LocalDate) -> Unit, openDay: (LocalDate) -> Unit, open: (CalItem) -> Unit) {
    val days = monthGrid(month, s.weekStart)
    LazyColumn(contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 112.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item(key = "grid") {
            Column(swipe.clip(RoundedCornerShape(18.dp)).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.surfaceContainer)) {
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    for (d in days.take(7)) Text(d.format(DateTimeFormatter.ofPattern("EEE")), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                }
                for (week in days.chunked(7)) {
                    Row(Modifier.fillMaxWidth()) {
                        for (d in week) {
                            val list = s.on(d, hidden)
                            val inMonth = d.month == month.month
                            val isSelected = d == selected
                            Column(
                                Modifier
                                    .weight(1f)
                                    .heightIn(min = 58.dp)
                                    .background(if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f) else if (!inMonth) MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.35f) else Color.Transparent)
                                    .clickable { pick(d) }
                                    .padding(vertical = 4.dp, horizontal = 3.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Box(
                                    Modifier.size(26.dp).clip(CircleShape).background(if (d == today) MaterialTheme.colorScheme.primary else Color.Transparent),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        "${d.dayOfMonth}",
                                        style = MaterialTheme.typography.labelMedium.merge(Numbers),
                                        fontWeight = if (d == today) FontWeight.SemiBold else FontWeight.Normal,
                                        color = when {
                                            d == today -> MaterialTheme.colorScheme.onPrimary
                                            inMonth -> MaterialTheme.colorScheme.onSurface
                                            else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                        },
                                    )
                                }
                                Spacer(Modifier.height(3.dp))
                                // A coloured bar per item (text doesn't fit a phone's month); the day's list is below.
                                for (item in list.take(4)) {
                                    Box(Modifier.padding(vertical = 1.dp).fillMaxWidth(0.8f).height(3.dp).clip(RoundedCornerShape(2.dp)).background(sourceColor(item.source).copy(alpha = if (item.projected) 0.45f else 1f)))
                                }
                            }
                        }
                    }
                }
            }
        }
        item(key = "day-head") {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                Text(selected.format(DateTimeFormatter.ofPattern("EEEE d MMMM")), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f).padding(start = 4.dp))
                TextButton(onClick = { openDay(selected) }) { Text("Open day") }
            }
        }
        val list = s.on(selected, hidden)
        if (list.isEmpty()) item(key = "nothing") { Muted("Nothing on this day.", modifier = Modifier.padding(horizontal = 4.dp)) }
        items(list, key = { it.id }) { item -> ItemRow(item) { open(item) } }
    }
}

@Composable
private fun ItemRow(item: CalItem, onClick: () -> Unit) {
    val color = sourceColor(item.source)
    val clock = DateTimeFormatter.ofPattern("HH:mm")
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(color.copy(alpha = 0.10f))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (item.icon != null || item.color != null) EntityIcon(item.icon, item.color, size = 28.dp)
        else Box(Modifier.width(4.dp).height(28.dp).clip(RoundedCornerShape(2.dp)).background(color))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(item.title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (item.done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
            Muted(
                listOfNotNull(item.start?.let { s -> s.format(clock) + (item.end?.let { "–" + it.format(clock) } ?: "") }, item.detail).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
            )
        }
    }
}

/* ------------------------------- Schedule ------------------------------- */

@Composable
private fun ScheduleView(s: CalendarState, from: LocalDate, hidden: Set<Source>, swipe: Modifier, today: LocalDate, onNew: () -> Unit, open: (CalItem) -> Unit) {
    val days = (0L until 30L).map { from.plusDays(it) }.filter { s.on(it, hidden).isNotEmpty() }
    if (days.isEmpty()) {
        Box(swipe.fillMaxSize().padding(16.dp)) {
            EmptyState(Icons.Outlined.EventNote, "Nothing in the next 30 days", "Events, due dates, costs and holidays show here as a list.") {
                OutlinedButton(onClick = onNew, shape = MaterialTheme.shapes.medium) { Text("New event") }
            }
        }
        return
    }
    LazyColumn(swipe, contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 112.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        items(days, key = { it.toString() }) { day ->
            Row {
                Column(Modifier.width(52.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(day.format(DateTimeFormatter.ofPattern("EEE")), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Box(Modifier.size(36.dp).clip(CircleShape).background(if (day == today) MaterialTheme.colorScheme.primary else Color.Transparent), contentAlignment = Alignment.Center) {
                        Text("${day.dayOfMonth}", style = MaterialTheme.typography.titleMedium.merge(Numbers), color = if (day == today) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (item in s.on(day, hidden)) ItemRow(item) { open(item) }
                }
            }
        }
    }
}

/* ------------------------------- Time grid ------------------------------- */

/**
 * Day and Week: hours down the side, a column per day, timed items at their
 * times (side by side where they overlap), all-day items in a strip on top,
 * a line for now, and prayer times as quiet dashed marks. Opens an hour
 * before now on today, else at 7:00.
 */
@Composable
private fun TimeGrid(
    days: List<LocalDate>,
    today: LocalDate,
    items: (LocalDate) -> List<CalItem>,
    marks: (LocalDate) -> List<Pair<String, LocalTime>>,
    swipe: Modifier,
    onSlot: (LocalDateTime) -> Unit,
    onItem: (CalItem) -> Unit,
    onDay: (LocalDate) -> Unit,
) {
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    val hourPx = with(density) { HOUR.toPx() }
    LaunchedEffect(days.first()) {
        val hour = if (today in days) (LocalTime.now().hour - 1).coerceAtLeast(0) else 7
        scroll.scrollTo((hour * hourPx).toInt())
    }
    val gutter = 44.dp
    val line = MaterialTheme.colorScheme.outlineVariant
    val markColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.55f)
    val now = MaterialTheme.colorScheme.error
    Column(swipe.fillMaxSize()) {
        if (days.size > 1) {
            Row(Modifier.fillMaxWidth().padding(end = 4.dp)) {
                Spacer(Modifier.width(gutter))
                for (d in days) {
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).clickable { onDay(d) }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(d.format(DateTimeFormatter.ofPattern("EEE")), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Box(Modifier.size(26.dp).clip(CircleShape).background(if (d == today) MaterialTheme.colorScheme.primary else Color.Transparent), contentAlignment = Alignment.Center) {
                            Text("${d.dayOfMonth}", style = MaterialTheme.typography.labelLarge.merge(Numbers), color = if (d == today) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }
        }
        // All-day strip.
        val allDay = days.map { d -> items(d).filter { it.start == null } }
        if (allDay.any { it.isNotEmpty() }) {
            Row(Modifier.fillMaxWidth().padding(end = 4.dp, bottom = 4.dp)) {
                Text("All day", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(gutter).padding(top = 4.dp, start = 6.dp))
                for (list in allDay) {
                    Column(Modifier.weight(1f).padding(horizontal = 1.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        for (item in list.take(if (days.size > 1) 2 else 4)) {
                            val c = sourceColor(item.source)
                            Text(
                                item.title,
                                style = MaterialTheme.typography.labelSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(c.copy(alpha = if (item.projected) 0.08f else 0.16f)).clickable { onItem(item) }.padding(horizontal = 4.dp, vertical = 3.dp),
                            )
                        }
                        val more = list.size - if (days.size > 1) 2 else 4
                        if (more > 0) Text("+$more", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }
        }
        Box(Modifier.weight(1f).verticalScroll(scroll)) {
            Row(Modifier.fillMaxWidth().height(HOUR * 24).padding(end = 4.dp)) {
                // Hours.
                Box(Modifier.width(gutter).fillMaxHeight()) {
                    for (h in 1 until 24) {
                        Text(
                            LocalTime.of(h, 0).format(DateTimeFormatter.ofPattern("HH:mm")),
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp).merge(Numbers),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.offset(x = 6.dp, y = HOUR * h - 7.dp),
                        )
                    }
                }
                days.forEachIndexed { index, d ->
                    val dayItems = items(d).filter { it.start != null }
                    val blocks = layoutTimed(dayItems.map { Triple(it.id, it.start!!, it.end) }, d)
                    val byId = dayItems.associateBy { it.id }
                    val dayMarks = marks(d)
                    BoxWithConstraints(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .pointerInput(d) {
                                detectTapGestures { offset ->
                                    // An empty slot: a new event there, on the half hour.
                                    val minutes = ((offset.y / hourPx) * 60).toInt().coerceIn(0, 23 * 60 + 30)
                                    onSlot(d.atStartOfDay().plusMinutes((minutes / 30 * 30).toLong()))
                                }
                            },
                    ) {
                        val width = maxWidth
                        Canvas(Modifier.fillMaxSize()) {
                            for (h in 0..24) drawLine(line, Offset(0f, h * hourPx), Offset(size.width, h * hourPx), strokeWidth = 1f)
                            drawLine(line, Offset(0f, 0f), Offset(0f, size.height), strokeWidth = 1f)
                            for ((_, time) in dayMarks) {
                                val y = (time.toSecondOfDay() / 3600f) * hourPx
                                drawLine(markColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)))
                            }
                            if (d == today) {
                                val y = (LocalTime.now().toSecondOfDay() / 3600f) * hourPx
                                drawLine(now, Offset(0f, y), Offset(size.width, y), strokeWidth = 3f)
                                drawCircle(now, 6f, Offset(0f, y))
                            }
                        }
                        // The prayer names once, in the first column; lines alone across the week.
                        if (index == 0) {
                            for ((label, time) in dayMarks) {
                                Text(
                                    label,
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                                    color = markColor,
                                    modifier = Modifier.offset(x = 4.dp, y = HOUR * (time.toSecondOfDay() / 3600f) - 12.dp),
                                )
                            }
                        }
                        for (block in blocks) {
                            val item = byId.getValue(block.id)
                            val c = sourceColor(item.source)
                            val colWidth = width / block.columns
                            Column(
                                Modifier
                                    .offset(x = colWidth * block.column + 1.dp, y = HOUR * (block.top / 60f) + 1.dp)
                                    .width(colWidth - 2.dp)
                                    .height(HOUR * (block.height / 60f) - 2.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(c.copy(alpha = 0.18f).compositeOver(MaterialTheme.colorScheme.background))
                                    .clickable { onItem(item) }
                                    .padding(start = 0.dp),
                            ) {
                                Row(Modifier.fillMaxSize()) {
                                    Box(Modifier.width(3.dp).fillMaxHeight().background(c))
                                    Column(Modifier.padding(horizontal = 4.dp, vertical = 2.dp)) {
                                        Text(item.title, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium, maxLines = if (block.height >= 60) 2 else 1, overflow = TextOverflow.Ellipsis)
                                        if (days.size == 1 && block.height >= 45) Text(item.start!!.format(DateTimeFormatter.ofPattern("HH:mm")) + (item.end?.let { "–" + it.format(DateTimeFormatter.ofPattern("HH:mm")) } ?: ""), style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
