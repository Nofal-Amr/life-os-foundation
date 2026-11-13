package app.lifeos.kt.feature.today

import android.media.RingtoneManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Medication
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.lifeos.kt.core.designsystem.Eyebrow
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.LocalSyncStatus
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.Skeleton
import app.lifeos.kt.core.designsystem.SyncAction
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.logic.daysUntil
import app.lifeos.kt.data.logic.greeting
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.stepsOf
import app.lifeos.kt.feature.tasks.AddTaskSheet
import app.lifeos.kt.navigation.Section
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.delay

/**
 * Today, remade from the website's: the one next action first, then the
 * prayers (the day's anchor), then what's on the table, how you are, and the
 * figures; a quiet overview closes the page. Everything the web shows is here.
 */
@Composable
fun TodayScreen(open: (Section) -> Unit, openTool: (String) -> Unit, openTask: (String) -> Unit, model: TodayViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val sync = LocalSyncStatus.current
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val toast = rememberToast()
    val context = LocalContext.current

    var prayerPick by rememberSaveable { mutableStateOf<String?>(null) }
    var focusFor by rememberSaveable { mutableStateOf<String?>(null) }
    var focusing by rememberSaveable { mutableStateOf(false) }
    var hardFor by rememberSaveable { mutableStateOf<String?>(null) }
    var shrinkFor by rememberSaveable { mutableStateOf<String?>(null) }
    var breathing by rememberSaveable { mutableStateOf(false) }
    var breakdown by rememberSaveable { mutableStateOf(false) }
    var adding by rememberSaveable { mutableStateOf(false) }

    // A live clock for the timer and the focus countdown; a buzz and a chime when focus time is up.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val s0 = state
    LaunchedEffect(s0?.running?.id, s0?.focusSession?.startedAt) {
        while (s0?.running != null || s0?.focusSession != null) {
            now = System.currentTimeMillis()
            val session = s0.focusSession
            if (session != null && now >= session.startedAt + session.minutes * 60_000L) {
                haptics.confirm()
                runCatching { RingtoneManager.getRingtone(context, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))?.play() }
                toast("Focus done" + (session.habitName?.let { ". $it ticked." } ?: "."))
                model.finishFocus()
                break
            }
            delay(1000)
        }
    }

    fun finish(task: Task) {
        model.finish(task)
        undo("Done: “${task.title}”") { model.restore(task) }
    }

    LifePage(
        title = state?.let { s -> greeting() + (s.firstName?.let { ", $it" } ?: "") } ?: "Today",
        subtitle = state?.today?.format(DateTimeFormatter.ofPattern("EEEE, d MMMM")),
        actions = { SyncAction() },
        refreshing = sync.state.running,
        onRefresh = sync.syncNow,
    ) {
        val s = state
        if (s == null) {
            items(4) { Skeleton(height = 120.dp) }
            return@LifePage
        }

        // The ring: one arc per area, each a real "done of planned today".
        if (s.ring.isNotEmpty()) {
            item(key = "ring") {
                LifeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Eyebrow("Planned for today")
                            Spacer(Modifier.height(8.dp))
                            RingLegend(s.ring)
                        }
                        TodayRing(s.ring)
                    }
                }
            }
        }

        // A running timer or focus session stays in sight.
        item(key = "running") {
            AnimatedVisibility(s.running != null, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
                val entry = s.running
                if (entry != null) {
                    val session = s.focusSession
                    LifeCard(color = MaterialTheme.colorScheme.primaryContainer) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Eyebrow(if (session != null) "Focus" else "Timer running", color = MaterialTheme.colorScheme.onPrimaryContainer)
                                Text(entry.label ?: "Timer", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                                val left = session?.let { (it.startedAt + it.minutes * 60_000L - now).coerceAtLeast(0) / 1000 }
                                Text(
                                    if (left != null) "%d:%02d left".format(left / 60, left % 60) else elapsedSince(entry.startedAt, java.time.Instant.ofEpochMilli(now)),
                                    style = MaterialTheme.typography.headlineSmall.merge(app.lifeos.kt.core.designsystem.Numbers),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                )
                            }
                            QuietAction(Icons.Outlined.Stop, "Stop") { haptics.tick(); model.stopTimer() }
                        }
                    }
                }
            }
        }

        item(key = "next") {
            NextActionCard(
                action = s.primary,
                fromEarlier = s.fromEarlier,
                capacityFit = s.capacityFit,
                running = s.running,
                onDone = { s.primary?.let { finish(it.item) } },
                onFocus = { focusFor = s.primary?.item?.id; focusing = true },
                onTimer = {
                    val action = s.primary ?: return@NextActionCard
                    if (s.running?.taskId == action.item.id) model.stopTimer() else model.startTimer(action.item, action.item.title)
                },
                onHard = { hardFor = s.primary?.parent?.id },
                onOpen = { s.primary?.let { openTask(it.parent.id) } },
                onAdd = { adding = true },
            )
        }

        // Prayers: the day's anchor, right after the one thing to do.
        item(key = "prayers") {
            LifeCard {
                StatusRow(
                    icon = Icons.Outlined.DarkMode,
                    label = "Prayers",
                    value = if (s.prayerTimes != null) "${s.prayedToday} of 5 logged today" + (s.city?.let { " · $it" } ?: "") else "Add your location once to see today's times.",
                    linkLabel = "Open Spirit",
                    onLink = { open(Section.Spirit) },
                    aside = if (s.prayerTimes != null) ({ Dots(s.prayedToday, 5) }) else null,
                ) {
                    if (s.prayerTimes != null) PrayerTiles(s.today, s.prayerLogs, s.prayerTimes) { name ->
                        // The sunnah prayers have one status, as on the web: a tap marks it, another clears it.
                        if (app.lifeos.kt.data.logic.isSunnah(name)) {
                            val logged = prayerStatus(s.prayerLogs.firstOrNull { it.prayerDate == s.today.toString() && it.prayerName == name }) != null
                            if (logged) haptics.tick() else haptics.confirm()
                            model.setPrayer(name, if (logged) null else "on_time")
                        } else {
                            haptics.tick()
                            prayerPick = name
                        }
                    }
                }
            }
        }

        s.stuck?.let { stuck ->
            item(key = "stuck") { StuckCard(stuck, onHelp = { hardFor = stuck.task.id }, onSnooze = { haptics.tick(); model.snoozeStuck(stuck.task.id) }) }
        }

        item(key = "counts") { CountTiles(s.counts) { label -> if (label == "Active projects") openTool("projects") else open(Section.Do) } }

        if (s.focus.isNotEmpty()) {
            item(key = "focus-h") { SectionHeader("Today's focus", action = "Add task", onAction = { adding = true }) }
            item(key = "focus") {
                FocusList(s.focus, s.today, onDone = { finish(it.action.item) }, onOpen = { openTask(it.action.parent.id) })
            }
        }

        item(key = "checkin") { CheckInCard(s.review?.mood, s.review?.energy, model::setMood, model::setEnergy, onReset = { breathing = true }) }

        // Body and money: one row each, acting on itself.
        item(key = "strips") {
            LifeCard(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)) {
                val doses = s.doses
                StatusRow(
                    icon = Icons.Outlined.Medication,
                    label = "Medication",
                    value = if (doses.isNotEmpty()) "${doses.count { !it.taken }} of ${doses.size} scheduled ${if (doses.size == 1) "entry remains" else "entries remain"} today" else "No medication times scheduled",
                    linkLabel = "Open medications",
                    onLink = { open(Section.Body) },
                    aside = if (doses.isNotEmpty()) ({ Dots(doses.count { it.taken }, doses.size) }) else null,
                ) { if (doses.isNotEmpty()) DoseTiles(doses) { model.setDose(it) } }
                HorizontalDivider()
                StatusRow(Icons.Outlined.FavoriteBorder, "Health log", if (s.healthLogged) "Logged today" else "Nothing logged yet today", if (s.healthLogged) "Open today's log" else "Log health", { open(Section.Body) })
                HorizontalDivider()
                StatusRow(Icons.Outlined.Restaurant, "Calories", s.calories?.let { "$it kcal logged today" } ?: "No food logged yet today", if (s.calories != null) "Open Food" else "Log food", { open(Section.Body) })
                HorizontalDivider()
                val m = s.money
                StatusRow(
                    icon = Icons.Outlined.AccountBalanceWallet,
                    label = "Money",
                    value = if (m.ready && m.payday != null) {
                        val days = daysUntil(m.payday, s.today)
                        (if (m.totals.available >= 0) "${s.formatter.format(m.totals.available)} left to spend" else "Short by ${s.formatter.format(kotlin.math.abs(m.totals.available))}") +
                            " · payday in $days ${if (days == 1L) "day" else "days"}"
                    } else {
                        "${s.formatter.format(m.totals.liquid)} now · payday not set up yet"
                    },
                    linkLabel = "Open Money",
                    onLink = { open(Section.Money) },
                    action = {
                        if (m.ready && m.payday != null) QuietAction(Icons.Outlined.Info, "Left before payday") { haptics.tick(); breakdown = true }
                        else QuietAction(Icons.Outlined.Info, "Set up payday") { open(Section.Money) }
                    },
                ) {
                    if (m.ready && m.payday != null) {
                        MoneySplit(m.totals, s.formatter)
                        m.lastPayday?.let { PaydayLine(it, m.payday) }
                    }
                }
            }
        }

        // A quiet overview closes the page.
        item(key = "overview-h") { SectionHeader("Overview") }
        item(key = "hub") { HubCard(s.hub) }
        item(key = "coming") {
            LifeCard {
                Text("Coming up", style = MaterialTheme.typography.titleMedium)
                if (s.comingUp.isEmpty()) Muted("Nothing due soon.", Modifier.padding(top = 6.dp))
                for (item in s.comingUp.take(6)) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Row {
                            Muted(if (item.commitment) "You do · " else "Happens · ", style = MaterialTheme.typography.bodyMedium)
                            Text(item.title, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                        }
                        Muted(item.detail, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    }
                }
            }
        }
        if (s.soFar.isNotEmpty()) {
            item(key = "sofar") {
                LifeCard {
                    Text("Today so far", style = MaterialTheme.typography.titleMedium)
                    for (line in s.soFar) {
                        Row(Modifier.padding(top = 6.dp)) {
                            Text(line.text, style = MaterialTheme.typography.bodyMedium)
                            line.detail?.let { Muted(" · $it", style = MaterialTheme.typography.bodyMedium, maxLines = 1) }
                        }
                    }
                }
            }
        }
        item(key = "links") {
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuietAction(Icons.Outlined.CalendarMonth, "Calendar") { haptics.tick(); openTool("calendar") }
                QuietAction(Icons.Outlined.EditNote, "Notes") { haptics.tick(); openTool("notes") }
            }
        }
    }

    val s = state ?: return
    prayerPick?.let { name ->
        PrayerStatusSheet(name, s.today, prayerStatus(s.prayerLogs.firstOrNull { it.prayerDate == s.today.toString() && it.prayerName == name }), pick = { model.setPrayer(name, it) }, close = { prayerPick = null })
    }
    if (focusing) {
        FocusSheet(s.allTasks.firstOrNull { it.id == focusFor }, s.habits, start = { label, minutes, habit -> model.startFocus(s.allTasks.firstOrNull { it.id == focusFor }, label, minutes, habit) }, close = { focusing = false })
    }
    s.allTasks.firstOrNull { it.id == hardFor }?.let { task ->
        StuckHelperSheet(
            task,
            close = { hardFor = null },
            shrink = { shrinkFor = task.id; hardFor = null },
            sprint = { minutes -> model.startFocus(task, task.title, minutes, null); toast("$minutes minutes on it. Stopping after that is fine."); hardFor = null },
            moveTo = { model.moveTo(task, it); toast("Moved"); hardFor = null },
            addStep = { model.addStep(task, it, 5); toast("Saved"); hardFor = null },
            setStatus = { model.setStatus(task, it); toast("Saved"); hardFor = null },
            together = { openTool("together"); hardFor = null },
        )
    }
    s.allTasks.firstOrNull { it.id == shrinkFor }?.let { task ->
        ShrinkItSheet(task, stepsOf(task, s.allTasks).size, add = { title, minutes -> model.addStep(task, title, minutes); toast("First step added.") }, close = { shrinkFor = null })
    }
    if (breathing) BreathingSheet(close = { breathing = false })
    if (breakdown && s.money.payday != null) MoneyBreakdownSheet(s.money.totals, s.money.payday, s.formatter, close = { breakdown = false })
    if (adding) AddTaskSheet(s.today, close = { adding = false }, addMany = { titles, due -> titles.forEach { model.add(it, due) } })
}

