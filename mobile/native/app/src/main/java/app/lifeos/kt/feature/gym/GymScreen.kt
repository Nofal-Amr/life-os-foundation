package app.lifeos.kt.feature.gym

import androidx.compose.animation.AnimatedContent
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.common.friendlyDate
import app.lifeos.kt.core.designsystem.DateChoice
import app.lifeos.kt.core.designsystem.EmptyState
import app.lifeos.kt.core.designsystem.LifeCard
import app.lifeos.kt.core.designsystem.LifePage
import app.lifeos.kt.core.designsystem.Muted
import app.lifeos.kt.core.designsystem.SectionHeader
import app.lifeos.kt.core.designsystem.SelectChip
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.core.designsystem.rememberToast
import app.lifeos.kt.core.designsystem.rememberUndo
import app.lifeos.kt.core.model.Workout
import app.lifeos.kt.core.model.WorkoutRoutine
import app.lifeos.kt.core.model.WorkoutSet
import app.lifeos.kt.data.GymRepository
import app.lifeos.kt.data.PreferencesRepository
import app.lifeos.kt.data.logic.DraftExercise
import app.lifeos.kt.data.logic.DraftRow
import app.lifeos.kt.data.logic.EXERCISES
import app.lifeos.kt.data.logic.WEEKDAY_SHORT
import app.lifeos.kt.data.logic.exerciseHistory
import app.lifeos.kt.data.logic.exerciseLine
import app.lifeos.kt.data.logic.exerciseSummary
import app.lifeos.kt.data.logic.heaviestSet
import app.lifeos.kt.data.logic.lastSession
import app.lifeos.kt.data.logic.loggedExercises
import app.lifeos.kt.data.logic.parseExerciseLine
import app.lifeos.kt.data.logic.parseRoutinesMarkdown
import app.lifeos.kt.data.logic.plannedLabel
import app.lifeos.kt.data.logic.routineDraft
import app.lifeos.kt.data.logic.routinesFor
import app.lifeos.kt.data.logic.setLabel
import app.lifeos.kt.data.newId
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class GymState(val workouts: List<Workout>, val sets: List<WorkoutSet>, val routines: List<WorkoutRoutine>, val unit: String, val today: LocalDate)

@HiltViewModel
class GymViewModel @Inject constructor(private val gym: GymRepository, prefs: PreferencesRepository) : ViewModel() {
    val state: StateFlow<GymState?> = combine(gym.workouts, gym.sets, gym.routines, prefs.preferences) { w, s, r, p ->
        GymState(w.sortedByDescending { it.performedOn }, s, r.sortedBy { it.name }, if (p?.unitSystem == "imperial") "lb" else "kg", LocalDate.now())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(s: GymState, workout: Workout, exercises: List<DraftExercise>) = viewModelScope.launch { gym.saveWorkout(workout, exercises, s.unit, s.sets) }
    fun delete(s: GymState, workout: Workout) = viewModelScope.launch { gym.deleteWorkout(workout, s.sets) }
    fun restore(workout: Workout, sets: List<WorkoutSet>) = viewModelScope.launch {
        gym.saveWorkout(workout, exerciseSummaryDraft(sets), sets.firstOrNull()?.unit ?: "kg", emptyList())
    }
    fun save(routine: WorkoutRoutine) = viewModelScope.launch { gym.save(routine) }
    fun delete(routine: WorkoutRoutine) = viewModelScope.launch { gym.delete(routine) }
}

/** A workout's sets back as an editable draft, exercise by exercise. */
fun exerciseSummaryDraft(sets: List<WorkoutSet>): List<DraftExercise> =
    sets.sortedBy { it.position }.groupBy { it.exercise.trim().lowercase() }.values.map { group ->
        DraftExercise(group.first().exercise, group.map { DraftRow(it.weight?.let { w -> if (w % 1.0 == 0.0) w.toLong().toString() else w.toString() } ?: "", it.reps?.toString() ?: "", it.seconds?.toString() ?: "") })
    }

private enum class GymTab(val label: String) { Today("Today"), Plan("Plan"), Exercises("Exercises") }

/** Gym: what you did (workouts of sets), what you mean to do (routines), and each exercise over time. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GymScreen(back: @Composable () -> Unit, model: GymViewModel = hiltViewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    val haptics = rememberHaptics()
    val undo = rememberUndo()
    var tab by rememberSaveable { mutableStateOf(GymTab.Today) }
    var logging by remember { mutableStateOf<Pair<Workout, List<DraftExercise>>?>(null) }
    var editingRoutine by remember { mutableStateOf<WorkoutRoutine?>(null) }
    var importing by rememberSaveable { mutableStateOf(false) }
    var exercise by rememberSaveable { mutableStateOf<String?>(null) }
    val s = state

    LifePage(
        title = "Gym",
        subtitle = "Only what you logged: sets, weights and reps.",
        navigationIcon = back,
        floatingActionButton = {
            if (s != null && tab != GymTab.Exercises) ExtendedFloatingActionButton(
                onClick = {
                    haptics.tick()
                    if (tab == GymTab.Plan) editingRoutine = WorkoutRoutine(newId(), "") else logging = Workout(newId(), s.today.toString()) to listOf(DraftExercise("", listOf(DraftRow())))
                },
                icon = { Icon(Icons.Outlined.Add, null) },
                text = { Text(if (tab == GymTab.Plan) "Routine" else "Log workout") },
            )
        },
    ) {
        if (s == null) return@LifePage
        item(key = "tabs") {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
                GymTab.entries.forEachIndexed { i, t ->
                    SegmentedButton(tab == t, { haptics.tick(); tab = t; exercise = null }, SegmentedButtonDefaults.itemShape(i, GymTab.entries.size), icon = {}) { Text(t.label) }
                }
            }
        }
        when (tab) {
            GymTab.Today -> {
                val planned = routinesFor(s.routines, s.today.dayOfWeek.value % 7)
                if (planned.isNotEmpty()) {
                    item(key = "planned-h") { SectionHeader("Today's plan") }
                    for (routine in planned) item(key = "planned-${routine.id}") {
                        LifeCard {
                            Text(routine.name, style = MaterialTheme.typography.titleMedium)
                            for (e in routine.exercises) Muted("${e.exercise} · ${plannedLabel(e, s.unit)}", Modifier.padding(top = 2.dp))
                            Spacer(Modifier.height(10.dp))
                            Button(onClick = {
                                haptics.tick()
                                logging = Workout(newId(), s.today.toString(), routine.name, routineId = routine.id) to routineDraft(routine) { lastSession(it, s.workouts, s.sets, s.today.toString()) }
                            }, shape = MaterialTheme.shapes.medium) { Text("Start") }
                        }
                    }
                }
                item(key = "workouts-h") { SectionHeader("Workouts") }
                if (s.workouts.isEmpty()) item(key = "empty") {
                    EmptyState(Icons.Outlined.FitnessCenter, "No workouts yet", "Log one after the gym, or start from a routine in Plan.")
                }
                for (workout in s.workouts.take(30)) item(key = workout.id) {
                    val sets = s.sets.filter { it.workoutId == workout.id }
                    LifeCard(onClick = { haptics.tick(); logging = workout to exerciseSummaryDraft(sets) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(workout.name ?: "Workout", style = MaterialTheme.typography.titleMedium)
                                Muted(friendlyDate(LocalDate.parse(workout.performedOn), s.today), style = MaterialTheme.typography.bodySmall)
                            }
                            IconButton(onClick = {
                                haptics.tick()
                                model.delete(s, workout)
                                undo("Workout removed") { model.restore(workout, sets) }
                            }) { Icon(Icons.Outlined.Close, "Remove workout", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                        for ((name, text) in exerciseSummary(sets)) {
                            Row(Modifier.padding(top = 4.dp)) {
                                Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                Muted(text, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
            GymTab.Plan -> {
                item(key = "plan-note") { Muted("A routine is what you mean to do; a workout is what you did. Start a routine to fill the log, then change it to what happened.", Modifier.padding(horizontal = 4.dp, vertical = 4.dp), style = MaterialTheme.typography.bodySmall) }
                if (s.routines.isEmpty()) item(key = "plan-empty") {
                    EmptyState(Icons.Outlined.FitnessCenter, "No routines yet", "Add one, or paste a plan written as Markdown.") {
                        OutlinedButton(onClick = { importing = true }, shape = MaterialTheme.shapes.medium) { Text("Paste a plan") }
                    }
                }
                for (routine in s.routines) item(key = routine.id) {
                    LifeCard(onClick = { haptics.tick(); editingRoutine = routine }) {
                        Text(routine.name, style = MaterialTheme.typography.titleMedium)
                        Muted(if (routine.weekdays.isEmpty()) "Any day" else routine.weekdays.joinToString(", ") { WEEKDAY_SHORT[it] }, style = MaterialTheme.typography.bodySmall)
                        for (e in routine.exercises) Text("${e.exercise} · ${plannedLabel(e, s.unit)}", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 3.dp))
                        routine.note?.let { Muted(it, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodySmall) }
                    }
                }
                if (s.routines.isNotEmpty()) item(key = "paste") { TextButton(onClick = { importing = true }) { Text("Paste a plan (Markdown)") } }
            }
            GymTab.Exercises -> {
                val names = loggedExercises(s.workouts, s.sets)
                val chosen = exercise
                if (chosen == null) {
                    if (names.isEmpty()) item(key = "ex-empty") { EmptyState(Icons.Outlined.FitnessCenter, "Nothing logged yet", "Each exercise you log shows up here with its history.") }
                    else item(key = "ex-list") {
                        LifeCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                            for (name in names) {
                                val last = lastSession(name, s.workouts, s.sets, s.today.toString())
                                Row(Modifier.fillMaxWidth().clickable { haptics.tick(); exercise = name }.padding(horizontal = 16.dp, vertical = 12.dp)) {
                                    Text(name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                                    last?.let { Muted(friendlyDate(LocalDate.parse(it.day), s.today), style = MaterialTheme.typography.bodySmall) }
                                }
                            }
                        }
                    }
                } else {
                    val history = exerciseHistory(chosen, s.workouts, s.sets)
                    item(key = "ex-head") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(chosen, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                            TextButton(onClick = { exercise = null }) { Text("All exercises") }
                        }
                    }
                    item(key = "ex-best") {
                        LifeCard {
                            val best = heaviestSet(history, s.unit) ?: heaviestSet(history, if (s.unit == "kg") "lb" else "kg")
                            Text("Heaviest set", style = MaterialTheme.typography.titleSmall)
                            Muted(best?.let { "${setLabel(it.first)} · ${friendlyDate(LocalDate.parse(it.second), s.today)}" } ?: "No weighted sets yet.", Modifier.padding(top = 2.dp))
                            Text("${history.size} ${if (history.size == 1) "session" else "sessions"} logged", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                    item(key = "ex-history") {
                        LifeCard {
                            history.forEachIndexed { i, session ->
                                if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
                                Text(friendlyDate(LocalDate.parse(session.day), s.today), style = MaterialTheme.typography.titleSmall)
                                Muted(session.sets.joinToString(", ", transform = ::setLabel), Modifier.padding(top = 2.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    val st = s ?: return
    logging?.let { (workout, draft) -> WorkoutSheet(st, workout, draft, close = { logging = null }) { w, d -> model.save(st, w, d) } }
    editingRoutine?.let { r -> RoutineSheet(r, st.unit, close = { editingRoutine = null }, delete = if (st.routines.any { it.id == r.id }) ({ model.delete(r); editingRoutine = null }) else null) { model.save(it) } }
    if (importing) PasteSheet(close = { importing = false }) { list -> list.forEach { model.save(WorkoutRoutine(newId(), it.name, it.weekdays, it.exercises, it.note)) } }
}

/** Log or edit one workout: exercises, each with its sets; "last time" beside each. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WorkoutSheet(s: GymState, workout: Workout, draft: List<DraftExercise>, close: () -> Unit, save: (Workout, List<DraftExercise>) -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    var name by rememberSaveable { mutableStateOf(workout.name.orEmpty()) }
    var day by rememberSaveable { mutableStateOf<String?>(workout.performedOn) }
    val exercises = remember { mutableStateListOf<DraftExercise>().apply { addAll(draft) } }
    val suggestions = (loggedExercises(s.workouts, s.sets) + EXERCISES).distinctBy { it.lowercase() }
    app.lifeos.kt.feature.tasks.EditorSheet(title = if (s.workouts.any { it.id == workout.id }) "Workout" else "Log workout", close = close, onSave = {
        val filled = exercises.filter { e -> e.name.isNotBlank() && e.rows.any { app.lifeos.kt.data.logic.draftSet(it.weight, it.reps, it.seconds) != null } }
        if (filled.isEmpty()) { haptics.reject(); toast("Add an exercise with at least one set."); false } else {
            haptics.confirm()
            save(workout.copy(name = name.trim().ifEmpty { null }, performedOn = day ?: s.today.toString()), filled)
            true
        }
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Name (optional, e.g. Push day)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        DateChoice(day, { day = it }, allowNone = false, past = true)
        exercises.forEachIndexed { index, e ->
            Column(Modifier.fillMaxWidth()) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(e.name, { v -> exercises[index] = e.copy(name = v) }, label = { Text("Exercise") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                if (e.name.isBlank()) {
                    FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        for (sug in suggestions.take(8)) SelectChip(false, sug, { haptics.tick(); exercises[index] = e.copy(name = sug) })
                    }
                } else lastSession(e.name, s.workouts, s.sets, day ?: s.today.toString(), workout.id)?.let { last ->
                    Muted("Last time (${friendlyDate(LocalDate.parse(last.day), s.today)}): ${last.sets.joinToString(", ", transform = ::setLabel)}", Modifier.padding(top = 4.dp), style = MaterialTheme.typography.bodySmall)
                }
                e.rows.forEachIndexed { r, row ->
                    Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Muted("${r + 1}", Modifier.width(20.dp))
                        OutlinedTextField(row.weight, { v -> exercises[index] = e.copy(rows = e.rows.toMutableList().also { it[r] = row.copy(weight = v.filter { c -> c.isDigit() || c == '.' || c == ',' }.take(6)) }) }, label = { Text(s.unit) }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
                        Spacer(Modifier.width(8.dp))
                        OutlinedTextField(row.reps, { v -> exercises[index] = e.copy(rows = e.rows.toMutableList().also { it[r] = row.copy(reps = v.filter(Char::isDigit).take(4)) }) }, label = { Text("reps") }, singleLine = true, shape = MaterialTheme.shapes.medium, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                        IconButton(onClick = { haptics.tick(); exercises[index] = e.copy(rows = if (e.rows.size > 1) e.rows - row else listOf(DraftRow())) }) { Icon(Icons.Outlined.Close, "Remove set") }
                    }
                }
                Row {
                    TextButton(onClick = { haptics.tick(); exercises[index] = e.copy(rows = e.rows + (e.rows.lastOrNull() ?: DraftRow())) }) { Text("Add set") }
                    Spacer(Modifier.weight(1f))
                    if (exercises.size > 1) TextButton(onClick = { haptics.tick(); exercises.removeAt(index) }) { Text("Remove exercise") }
                }
            }
        }
        OutlinedButton(onClick = { haptics.tick(); exercises.add(DraftExercise("", listOf(DraftRow()))) }, shape = MaterialTheme.shapes.medium) {
            Icon(Icons.Outlined.Add, null)
            Spacer(Modifier.width(6.dp))
            Text("Add exercise")
        }
    }
}

/** A routine: name, days, and one exercise per line ("Bench press: 3x8 @ 60"). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RoutineSheet(routine: WorkoutRoutine, unit: String, close: () -> Unit, delete: (() -> Unit)?, save: (WorkoutRoutine) -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    var name by rememberSaveable { mutableStateOf(routine.name) }
    var days by rememberSaveable { mutableStateOf(routine.weekdays) }
    var lines by rememberSaveable { mutableStateOf(routine.exercises.joinToString("\n", transform = ::exerciseLine)) }
    var note by rememberSaveable { mutableStateOf(routine.note.orEmpty()) }
    val parsed = lines.lines().mapNotNull(::parseExerciseLine)
    app.lifeos.kt.feature.tasks.EditorSheet(title = if (routine.name.isEmpty()) "New routine" else "Routine", close = close, delete = delete, onSave = {
        if (name.isBlank() || parsed.isEmpty()) { haptics.reject(); toast("A routine needs a name and at least one exercise."); false } else {
            haptics.confirm(); save(routine.copy(name = name.trim().take(80), weekdays = days.sorted(), exercises = parsed, note = note.trim().ifEmpty { null })); true
        }
    }) {
        OutlinedTextField(name, { name = it }, label = { Text("Name (e.g. Push day)") }, singleLine = true, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        Muted("Days", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            WEEKDAY_SHORT.forEachIndexed { i, label -> SelectChip(i in days, label, { haptics.tick(); days = if (i in days) days - i else days + i }) }
        }
        OutlinedTextField(lines, { lines = it }, label = { Text("Exercises, one per line") }, placeholder = { Text("Bench press: 3x8 @ 60\nPlank: 3x45s") }, minLines = 4, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        if (parsed.isNotEmpty()) for (e in parsed) Muted("${e.exercise} · ${plannedLabel(e, unit)}", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(note, { note = it }, label = { Text("Note (optional)") }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
    }
}

/** Routines from a plan written as Markdown (from a coach, a note or an AI chat). */
@Composable
private fun PasteSheet(close: () -> Unit, add: (List<app.lifeos.kt.data.logic.RoutineInput>) -> Unit) {
    val haptics = rememberHaptics()
    val toast = rememberToast()
    var text by rememberSaveable { mutableStateOf("") }
    val found = parseRoutinesMarkdown(text)
    app.lifeos.kt.feature.tasks.EditorSheet(title = "Paste a plan", close = close, onSave = {
        if (found.isEmpty()) { haptics.reject(); false } else { haptics.confirm(); add(found); toast("${found.size} ${if (found.size == 1) "routine" else "routines"} added"); true }
    }) {
        Muted("Each \"#\" heading starts a routine, \"Days:\" sets its days, and list lines are its exercises.", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(text, { text = it }, placeholder = { Text("# Push day\nDays: Sun, Wed\n- Bench press: 3x8 @ 60kg\n- Plank: 3x45s") }, minLines = 6, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
        AnimatedContent(found.size, label = "found") { n -> Muted(if (n == 0) "No routines found yet." else "Found: " + found.joinToString(", ") { it.name }) }
    }
}
