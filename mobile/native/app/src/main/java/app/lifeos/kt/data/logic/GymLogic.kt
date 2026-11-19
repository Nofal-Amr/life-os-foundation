package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.PlannedExercise
import app.lifeos.kt.core.model.Workout
import app.lifeos.kt.core.model.WorkoutRoutine
import app.lifeos.kt.core.model.WorkoutSet

/*
 * Gym, ported from the website (src/data/gym.ts, src/data/gymRoutines.ts).
 * Everything shown is what was logged: the last time you did an exercise,
 * your heaviest set, the reps at a weight. No scores, estimated maxes or targets.
 */

/** Common exercises, offered as suggestions; any name can be typed. */
val EXERCISES = listOf(
    "Bench press", "Incline bench press", "Dumbbell press", "Overhead press", "Squat", "Front squat", "Leg press", "Lunge",
    "Deadlift", "Romanian deadlift", "Hip thrust", "Pull-up", "Chin-up", "Lat pulldown", "Barbell row", "Dumbbell row",
    "Seated cable row", "Push-up", "Dip", "Biceps curl", "Hammer curl", "Triceps pushdown", "Lateral raise", "Face pull",
    "Leg curl", "Leg extension", "Calf raise", "Plank", "Crunch", "Running", "Cycling", "Rowing machine",
)

val WEEKDAY_SHORT = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

/** The same exercise however it was typed: case and spacing don't matter. */
fun exerciseKey(name: String) = name.trim().replace(Regex("\\s+"), " ").lowercase()

private fun num(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(java.util.Locale.ROOT, value).trimEnd('0').trimEnd('.')

/** "60 kg × 8", "× 12", "60 kg", "45 s". */
fun setLabel(set: WorkoutSet): String = listOfNotNull(
    set.weight?.let { "${num(it)} ${set.unit}" },
    set.reps?.let { "× $it" },
    set.seconds?.let { "$it s" },
).joinToString(" ")

/** Each exercise once, in the order first done, with its sets; identical sets read "3 × 60 kg × 8". */
fun exerciseSummary(sets: List<WorkoutSet>): List<Pair<String, String>> =
    sets.sortedBy { it.position }.groupBy { exerciseKey(it.exercise) }.values.map { group ->
        val labels = group.map(::setLabel)
        val same = labels.all { it == labels.first() }
        group.first().exercise.trim() to (if (same && labels.size > 1) "${labels.size} × ${labels.first()}" else labels.joinToString(", "))
    }

data class ExerciseSession(val workoutId: String, val day: String, val sets: List<WorkoutSet>)

/** Every session of one exercise, newest first. */
fun exerciseHistory(exercise: String, workouts: List<Workout>, sets: List<WorkoutSet>): List<ExerciseSession> {
    val key = exerciseKey(exercise)
    val byWorkout = sets.filter { exerciseKey(it.exercise) == key }.groupBy { it.workoutId }
    return workouts.filter { it.id in byWorkout }
        .map { ExerciseSession(it.id, it.performedOn, byWorkout.getValue(it.id).sortedBy { s -> s.position }) }
        .sortedWith(compareByDescending<ExerciseSession> { it.day }.thenByDescending { it.workoutId })
}

/** The last session of an exercise on or before a day (for "last time" while logging). */
fun lastSession(exercise: String, workouts: List<Workout>, sets: List<WorkoutSet>, beforeOrOn: String, excludeWorkoutId: String? = null): ExerciseSession? =
    exerciseHistory(exercise, workouts, sets).firstOrNull { it.day <= beforeOrOn && it.workoutId != excludeWorkoutId }

/** The heaviest set in one unit (most reps breaks a tie); other-unit sets are left out, not converted. */
fun heaviestSet(sessions: List<ExerciseSession>, unit: String): Pair<WorkoutSet, String>? {
    var best: Pair<WorkoutSet, String>? = null
    for (session in sessions) for (set in session.sets) {
        val w = set.weight ?: continue
        if (set.unit != unit) continue
        val b = best?.first
        if (b == null || w > b.weight!! || (w == b.weight && (set.reps ?: 0) > (b.reps ?: 0))) best = set to session.day
    }
    return best
}

/** Distinct exercises logged, most recent first. */
fun loggedExercises(workouts: List<Workout>, sets: List<WorkoutSet>): List<String> {
    val dayOf = workouts.associate { it.id to it.performedOn }
    val latest = mutableMapOf<String, Pair<String, String>>()
    for (set in sets) {
        val key = exerciseKey(set.exercise)
        val day = dayOf[set.workoutId] ?: ""
        val seen = latest[key]
        if (seen == null || day > seen.second) latest[key] = set.exercise.trim() to day
    }
    return latest.values.sortedWith(compareByDescending<Pair<String, String>> { it.second }.thenBy { it.first }).map { it.first }
}

data class DraftValues(val weight: Double?, val reps: Int?, val seconds: Int?)

/** A set from what was typed: blanks are null; a set needs weight, reps or time. */
fun draftSet(weight: String, reps: String, seconds: String = ""): DraftValues? {
    fun read(text: String, max: Double): Double? {
        val v = text.replace(",", ".").trim().toDoubleOrNull() ?: return null
        return if (v < 0 || v > max) null else v
    }
    val set = DraftValues(read(weight, 2000.0), read(reps, 1000.0)?.let { Math.round(it).toInt() }, read(seconds, 86400.0)?.let { Math.round(it).toInt() })
    return if (set.weight == null && set.reps == null && set.seconds == null) null else set
}

/* --------------------------------- routines --------------------------------- */

/** Routines planned for a weekday (0 = Sunday), in name order. */
fun routinesFor(routines: List<WorkoutRoutine>, weekday: Int): List<WorkoutRoutine> =
    routines.filter { weekday in it.weekdays }.sortedBy { it.name }

/** "3 × 8 · 60 kg", "3 × 45 s", "2 sets". */
fun plannedLabel(item: PlannedExercise, unit: String = "kg"): String {
    val scheme = when {
        item.reps != null -> "${item.sets} × ${item.reps}"
        item.seconds != null -> "${item.sets} × ${item.seconds} s"
        else -> "${item.sets} ${if (item.sets == 1) "set" else "sets"}"
    }
    return listOfNotNull(scheme, item.weight?.let { "${num(it)} $unit" }).joinToString(" · ")
}

data class DraftRow(val weight: String = "", val reps: String = "", val seconds: String = "")
data class DraftExercise(val name: String, val rows: List<DraftRow>)

/** The log's starting point for a routine: one row per planned set, with the planned weight or last time's. */
fun routineDraft(routine: WorkoutRoutine, last: (String) -> ExerciseSession?): List<DraftExercise> = routine.exercises.map { item ->
    val lastWeight = last(item.exercise)?.sets?.firstOrNull { it.weight != null }?.weight
    val weight = item.weight ?: lastWeight
    val row = DraftRow(weight?.let(::num) ?: "", item.reps?.toString() ?: "", item.seconds?.toString() ?: "")
    DraftExercise(item.exercise, List(maxOf(1, item.sets)) { row })
}

private val DAY_NAMES = mapOf(
    "sun" to 0, "sunday" to 0, "mon" to 1, "monday" to 1, "tue" to 2, "tues" to 2, "tuesday" to 2, "wed" to 3, "wednesday" to 3,
    "thu" to 4, "thur" to 4, "thurs" to 4, "thursday" to 4, "fri" to 5, "friday" to 5, "sat" to 6, "saturday" to 6,
)

/** "Sun, Wed" or "Sunday and Wednesday" → [0, 3]; unknown words are ignored. */
fun parseWeekdays(text: String): List<Int> = text.lowercase().split(Regex("[^a-z]+")).mapNotNull(DAY_NAMES::get).distinct().sorted()

/** One exercise line: "Bench press: 3x8 @ 60kg", "Plank: 3 x 45s", "Leg press 4×12 100", "Pull-up: 3 sets". */
fun parseExerciseLine(line: String): PlannedExercise? {
    val text = line.replace(Regex("^\\s*(?:[-*+]|\\d+[.)])\\s*"), "").trim()
    if (text.isEmpty()) return null
    val scheme = Regex("(\\d+)\\s*[x×]\\s*(\\d+)\\s*(s|sec|secs|seconds)?\\b", RegexOption.IGNORE_CASE).find(text)
    val setsOnly = if (scheme == null) Regex("(\\d+)\\s*sets?\\b", RegexOption.IGNORE_CASE).find(text) else null
    val cut = scheme?.range?.first ?: setsOnly?.range?.first ?: text.length
    val name = text.substring(0, cut).replace(Regex("[:\\-–—,]+\\s*$"), "").trim()
    if (name.isEmpty()) return null
    val rest = text.substring(minOf(text.length, cut + (scheme?.value?.length ?: setsOnly?.value?.length ?: 0)))
    val weight = Regex("(?:@|at)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(kg|lb|lbs)?", RegexOption.IGNORE_CASE).find(rest)?.groupValues?.get(1)?.replace(",", ".")?.toDoubleOrNull()
    val timed = scheme?.groupValues?.get(3)?.isNotEmpty() == true
    return PlannedExercise(
        exercise = name.take(80),
        sets = minOf(20, (scheme?.groupValues?.get(1) ?: setsOnly?.groupValues?.get(1) ?: "1").toInt()),
        reps = if (scheme != null && !timed) scheme.groupValues[2].toInt() else null,
        seconds = if (scheme != null && timed) scheme.groupValues[2].toInt() else null,
        weight = weight,
    )
}

/** A routine's exercises as editable lines ("Bench press: 3x8 @ 60kg"), the reverse of [parseExerciseLine]. */
fun exerciseLine(item: PlannedExercise): String {
    val scheme = when {
        item.reps != null -> "${item.sets}x${item.reps}"
        item.seconds != null -> "${item.sets}x${item.seconds}s"
        else -> "${item.sets} sets"
    }
    return "${item.exercise}: $scheme" + (item.weight?.let { " @ ${num(it)}" } ?: "")
}

data class RoutineInput(val name: String, val weekdays: List<Int>, val exercises: List<PlannedExercise>, val note: String?)

/** Routines from Markdown: "#" headings start one; "Days:" sets weekdays; list lines are exercises; other lines the note. */
fun parseRoutinesMarkdown(markdown: String): List<RoutineInput> {
    val out = mutableListOf<RoutineInput>()
    var name: String? = null
    var days = emptyList<Int>()
    val exercises = mutableListOf<PlannedExercise>()
    val notes = mutableListOf<String>()
    fun close() {
        name?.let { if (exercises.isNotEmpty()) out += RoutineInput(it, days, exercises.toList(), notes.joinToString("\n").trim().take(2000).ifEmpty { null }) }
        exercises.clear(); notes.clear(); days = emptyList()
    }
    for (raw in markdown.lines()) {
        val line = raw.trim()
        val heading = Regex("^#{1,3}\\s+(.+)$").find(line)
        if (heading != null) {
            close()
            name = heading.groupValues[1].trim().take(80)
            continue
        }
        if (name == null || line.isEmpty()) continue
        val d = Regex("^days?\\s*:\\s*(.+)$", RegexOption.IGNORE_CASE).find(line)
        when {
            d != null -> days = parseWeekdays(d.groupValues[1])
            Regex("^(?:[-*+]|\\d+[.)])\\s+").containsMatchIn(line) -> parseExerciseLine(line)?.let { exercises += it }
            else -> notes += line
        }
    }
    close()
    return out
}
