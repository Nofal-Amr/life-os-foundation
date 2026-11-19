package app.lifeos.kt.feature.review

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.MoneyFormatter
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.designsystem.DayBar
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.DailyReview
import app.lifeos.kt.core.model.Note
import app.lifeos.kt.core.model.Task
import app.lifeos.kt.data.BodyRepository
import app.lifeos.kt.data.MoneyRepository
import app.lifeos.kt.data.PlanRepository
import app.lifeos.kt.data.PlannerRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.SpiritRepository
import app.lifeos.kt.data.TaskRepository
import app.lifeos.kt.data.TodayRepository
import app.lifeos.kt.data.logic.DayLine
import app.lifeos.kt.data.logic.EVENING_HOUR
import app.lifeos.kt.data.logic.ReflectionKind
import app.lifeos.kt.data.logic.ReflectionLine
import app.lifeos.kt.data.logic.carryOver
import app.lifeos.kt.data.logic.dayLines
import app.lifeos.kt.data.logic.dayReflections
import app.lifeos.kt.data.logic.prayerStatus
import app.lifeos.kt.data.logic.reflectionTag
import app.lifeos.kt.data.logic.weekCounts
import app.lifeos.kt.data.logic.weekRecap
import app.lifeos.kt.data.logic.weekStartOf
import app.lifeos.kt.data.logic.withReflection
import app.lifeos.kt.data.moduleOn
import app.lifeos.kt.data.newId
import app.lifeos.kt.feature.today.ENERGY_LABELS
import app.lifeos.kt.feature.today.MOOD_LABELS
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ReviewState(
    val date: LocalDate,
    val today: LocalDate,
    val review: DailyReview?,
    val reflections: List<ReflectionLine>,
    val summary: List<DayLine>,
    val carry: List<Task>,
    val week: List<String>,
    val recent: List<DailyReview>,
)

@HiltViewModel
class ReviewViewModel @Inject constructor(
    private val day: TodayRepository,
    private val tasks: TaskRepository,
    private val planner: PlannerRepository,
    plan: PlanRepository,
    spirit: SpiritRepository,
    money: MoneyRepository,
    body: BodyRepository,
    prefs: PreferencesRepository,
) : ViewModel() {
    val date = MutableStateFlow(LocalDate.now())

    private val habitsAndLogs = combine(plan.habits, plan.habitLogs, spirit.logs) { h, l, p -> Triple(h, l, p) }
    private val moneyData = combine(money.transactions, money.categories, prefs.preferences) { t, c, p -> Triple(t, c, p) }
    private val bodyData = combine(body.healthLogs, body.medications, day.medicationLogs, day.foodLogs) { h, m, ml, f -> listOf(h, m, ml, f) }

    val state: StateFlow<ReviewState?> = combine(
        combine(date, day.reviews, planner.notes, tasks.tasks) { d, r, n, t -> listOf(d, r, n, t) },
        habitsAndLogs, moneyData, bodyData,
    ) { a, (habits, habitLogs, prayerLogs), (transactions, categories, p), b ->
        @Suppress("UNCHECKED_CAST") val d = a[0] as LocalDate
        @Suppress("UNCHECKED_CAST") val reviews = a[1] as List<DailyReview>
        @Suppress("UNCHECKED_CAST") val notes = a[2] as List<Note>
        @Suppress("UNCHECKED_CAST") val taskList = a[3] as List<Task>
        @Suppress("UNCHECKED_CAST") val health = b[0] as List<app.lifeos.kt.core.model.HealthLog>
        @Suppress("UNCHECKED_CAST") val meds = b[1] as List<app.lifeos.kt.core.model.Medication>
        @Suppress("UNCHECKED_CAST") val medLogs = b[2] as List<app.lifeos.kt.core.model.MedicationLog>
        @Suppress("UNCHECKED_CAST") val food = b[3] as List<app.lifeos.kt.core.model.FoodLog>
        val today = LocalDate.now()
        val t = d.toString()
        val formatter = MoneyFormatter(p?.currency)
        val review = reviews.firstOrNull { it.reviewDate == t }
        val prayed = prayerLogs.count { it.prayerDate == t && prayerStatus(it).let { s -> s != null && s != "missed" } && !app.lifeos.kt.data.logic.isSunnah(it.prayerName) }
        val ticked = habitLogs.count { it.logDate == t }
        val week = weekCounts(weekStartOf(d, p?.weekStart ?: 1), today, taskList, habits, habitLogs, prayerLogs, transactions, moduleOn(p?.enabledModules, "spirit"))
        ReviewState(
            date = d,
            today = today,
            review = review,
            reflections = dayReflections(review, notes, t),
            summary = dayLines(d, taskList, transactions, categories, food, meds, medLogs, health.firstOrNull { it.logDate == t }, prayed, ticked, formatter::format),
            carry = if (d == today) carryOver(taskList, t) else emptyList(),
            week = weekRecap(week, formatter::format),
            recent = reviews.filter { it.reviewDate != t && it.reviewDate <= today.toString() }.sortedByDescending { it.reviewDate }.take(14),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** One reflection: good, hard and grateful go into the day's review; ideas and notes become notes. */
    fun reflect(kind: ReflectionKind, text: String) = viewModelScope.launch {
        val line = text.trim().takeIf { it.isNotEmpty() } ?: return@launch
        val d = date.value.toString()
        if (kind == ReflectionKind.Idea || kind == ReflectionKind.Note) {
            planner.save(Note(newId(), body = line, tags = listOf(reflectionTag(kind)), createdAt = nowIso()))
        } else {
            day.saveCheckIn(d, day.reviews.first()) { withReflection(it, kind, line) }
        }
    }

    fun setMood(mood: Int?) = viewModelScope.launch { day.saveCheckIn(date.value.toString(), day.reviews.first()) { it.copy(mood = mood) } }
    fun setEnergy(energy: Int?) = viewModelScope.launch { day.saveCheckIn(date.value.toString(), day.reviews.first()) { it.copy(energy = energy) } }

    fun saveWritten(wins: String, challenges: String, gratitude: String, focus: String) = viewModelScope.launch {
        val d = date.value.toString()
        day.saveCheckIn(d, day.reviews.first()) {
            it.copy(
                wins = wins.trim().ifEmpty { null },
                challenges = challenges.trim().ifEmpty { null },
                gratitude = gratitude.trim().ifEmpty { null },
                tomorrowFocus = focus.trim().ifEmpty { null },
            )
        }
    }

    /** Close the day: every open task dated today or earlier moves to tomorrow. Returns them as they were, for Undo. */
    suspend fun moveToTomorrow(list: List<Task>): List<Task> {
        val tomorrow = LocalDate.now().plusDays(1).toString()
        list.forEach { tasks.moveTo(it, tomorrow) }
        return list
    }

    fun restore(previous: List<Task>) = viewModelScope.launch { previous.forEach { tasks.save(it) } }
}

/** The day's review: reflect one line at a time, close the day, how it felt, and the week so far. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReviewScreen(back: @Composable () -> Unit, model: ReviewViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var kind by rememberSaveable { mutableStateOf(ReflectionKind.Good) }
    var text by rememberSaveable { mutableStateOf("") }
    var editing by rememberSaveable { mutableStateOf(false) }
    val s = state

    LifePage(title = "Review", subtitle = "One line at a time. The day's review gathers them.", navigationIcon = back) {
        if (s == null) return@LifePage
        item(key = "day") { DayBar(s.date, s.today) { model.date.value = it } }

        // Close the day: offered in the evening, or whenever the day being reviewed is today and something's left.
        if (s.carry.isNotEmpty() && (LocalTime.now().hour >= EVENING_HOUR || s.date == s.today)) item(key = "close") {
            LifeCard {
                Text("Close the day", style = MaterialTheme.typography.titleMedium)
                Muted(
                    "${s.carry.size} open ${if (s.carry.size == 1) "task is" else "tasks are"} dated today or earlier. Move ${if (s.carry.size == 1) "it" else "them"} to tomorrow and start fresh.",
                    Modifier.padding(top = 4.dp),
                )
                Column(Modifier.padding(top = 8.dp)) {
                    for (task in s.carry.take(5)) Text("· ${task.title}", style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                    if (s.carry.size > 5) Muted("and ${s.carry.size - 5} more", style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(12.dp))
                Button(onClick = {
                    haptics.confirm()
                    scope.launch {
                        val moved = model.moveToTomorrow(s.carry)
                        undo("${moved.size} moved to tomorrow") { model.restore(moved) }
                    }
                }, shape = MaterialTheme.shapes.medium) {
                    Text("Move to tomorrow")
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, null)
                }
            }
        }

        item(key = "reflect") {
            LifeCard(Modifier.animateContentSize()) {
                Text("Reflect", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (k in ReflectionKind.entries) SelectChip(kind == k, k.label, { haptics.tick(); kind = k })
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    text, { text = it },
                    placeholder = { Text(kind.placeholder) },
                    minLines = 2,
                    shape = MaterialTheme.shapes.medium,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { haptics.confirm(); model.reflect(kind, text); text = "" },
                    enabled = text.isNotBlank(),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) { Text("Add") }
                AnimatedVisibility(s.reflections.isNotEmpty()) {
                    Column(Modifier.padding(top = 14.dp)) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Spacer(Modifier.height(10.dp))
                        for (line in s.reflections) {
                            Row(Modifier.padding(vertical = 3.dp)) {
                                Muted(line.label, Modifier.width(68.dp), style = MaterialTheme.typography.labelMedium)
                                Text(line.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }

        item(key = "feel") {
            LifeCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("How it felt", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    TextButton(onClick = { haptics.tick(); editing = true }) {
                        Icon(Icons.Outlined.Edit, null)
                        Spacer(Modifier.width(6.dp))
                        Text("Write more")
                    }
                }
                Muted("Mood", Modifier.padding(top = 4.dp, bottom = 6.dp), style = MaterialTheme.typography.bodySmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    MOOD_LABELS.forEachIndexed { i, label -> SelectChip(s.review?.mood == i + 1, label, { haptics.tick(); model.setMood(if (s.review?.mood == i + 1) null else i + 1) }) }
                }
                Muted("Energy", Modifier.padding(top = 10.dp, bottom = 6.dp), style = MaterialTheme.typography.bodySmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ENERGY_LABELS.forEachIndexed { i, label -> SelectChip(s.review?.energy == i + 1, label, { haptics.tick(); model.setEnergy(if (s.review?.energy == i + 1) null else i + 1) }) }
                }
                s.review?.tomorrowFocus?.let { Muted("Tomorrow's focus: $it", Modifier.padding(top = 12.dp)) }
            }
        }

        if (s.summary.isNotEmpty()) {
            item(key = "summary-h") { SectionHeader(if (s.date == s.today) "Today so far" else "That day") }
            item(key = "summary") {
                LifeCard {
                    for (line in s.summary) {
                        Row(Modifier.padding(vertical = 3.dp)) {
                            Text(line.text, style = MaterialTheme.typography.bodyMedium)
                            line.detail?.let { Muted(" · $it", style = MaterialTheme.typography.bodyMedium, maxLines = 1) }
                        }
                    }
                }
            }
        }

        if (s.week.isNotEmpty()) {
            item(key = "week-h") { SectionHeader("This week") }
            item(key = "week") {
                LifeCard { for (line in s.week) Text(line, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 3.dp)) }
            }
        }

        if (s.recent.isNotEmpty()) {
            item(key = "recent-h") { SectionHeader("Recent reviews") }
            item(key = "recent") {
                LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                    for (r in s.recent) {
                        Row(
                            Modifier.fillMaxWidth().clickable { haptics.tick(); model.date.value = LocalDate.parse(r.reviewDate) }.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(friendlyDate(LocalDate.parse(r.reviewDate), s.today).let { if (it.length < 12) "$it · ${LocalDate.parse(r.reviewDate).format(DateTimeFormatter.ofPattern("d MMM"))}" else it }, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            Muted(listOfNotNull(r.mood?.let { MOOD_LABELS[it - 1] }, r.energy?.let { "${ENERGY_LABELS[it - 1]} energy" }).joinToString(" · ").ifEmpty { "Written" }, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }

    if (editing && s != null) WriteSheet(s.review, close = { editing = false }) { w, c, g, f -> model.saveWritten(w, c, g, f) }
}

/** The day's review in full, to edit: one line per reflection in each box. */
@Composable
private fun WriteSheet(review: DailyReview?, close: () -> Unit, save: (String, String, String, String) -> Unit) {
    var wins by rememberSaveable { mutableStateOf(review?.wins.orEmpty()) }
    var challenges by rememberSaveable { mutableStateOf(review?.challenges.orEmpty()) }
    var gratitude by rememberSaveable { mutableStateOf(review?.gratitude.orEmpty()) }
    var focus by rememberSaveable { mutableStateOf(review?.tomorrowFocus.orEmpty()) }
    val haptics = rememberHaptics()
    app.lifeos.kt.feature.tasks.EditorSheet(title = "The day's review", close = close, onSave = { haptics.confirm(); save(wins, challenges, gratitude, focus); true }) {
        Muted("One line per thing. Saving again updates the same day.", style = MaterialTheme.typography.bodySmall)
        for ((label, value, set) in listOf(
            Triple("Good things", wins) { v: String -> wins = v },
            Triple("Hard things", challenges) { v: String -> challenges = v },
            Triple("Grateful for", gratitude) { v: String -> gratitude = v },
        )) {
            OutlinedTextField(value, set, label = { Text(label) }, minLines = 2, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(focus, { focus = it }, label = { Text("Tomorrow's focus") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
    }
}
