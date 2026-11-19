package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.PlannedExercise
import app.lifeos.kt.core.model.Workout
import app.lifeos.kt.core.model.WorkoutRoutine
import app.lifeos.kt.core.model.WorkoutSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The website's gym tests (src/data/gym.test.ts, gymRoutines.test.ts), ported. */
class GymLogicTest {
    private var n = 0
    private fun set(workout: String, exercise: String, weight: Double?, reps: Int?, unit: String = "kg") =
        WorkoutSet("s$n", workout, exercise, n++, reps, weight, unit)

    private val workouts = listOf(Workout("w1", "2026-11-02"), Workout("w2", "2026-11-09"), Workout("w3", "2026-11-16"))
    private val sets = listOf(
        set("w1", "Bench press", 60.0, 8), set("w1", "Bench press", 60.0, 8), set("w1", "Squat", 80.0, 5),
        set("w2", "bench  Press", 62.5, 8), set("w2", "Bench press", 65.0, 6),
        set("w3", "Squat", 85.0, 5), set("w3", "Bench press", 135.0, 5, "lb"),
    )

    @Test fun labelsAndKeys() {
        assertEquals("62.5 kg × 8", setLabel(WorkoutSet("a", "w", "B", reps = 8, weight = 62.5)))
        assertEquals("× 12", setLabel(WorkoutSet("a", "w", "B", reps = 12)))
        assertEquals("45 s", setLabel(WorkoutSet("a", "w", "B", seconds = 45)))
        assertEquals("bench press", exerciseKey("  bench  Press "))
    }

    @Test fun summariesGroupIdenticalSets() {
        assertEquals(listOf("Bench press" to "2 × 60 kg × 8", "Squat" to "80 kg × 5"), exerciseSummary(sets.filter { it.workoutId == "w1" }))
        assertEquals(listOf("bench  Press" to "62.5 kg × 8, 65 kg × 6"), exerciseSummary(sets.filter { it.workoutId == "w2" }))
    }

    @Test fun historyLastTimeAndHeaviest() {
        assertEquals(listOf("2026-11-16", "2026-11-09", "2026-11-02"), exerciseHistory("BENCH PRESS", workouts, sets).map { it.day })
        assertEquals("2026-11-09", lastSession("Bench press", workouts, sets, "2026-11-16", "w3")?.day)
        assertNull(lastSession("Deadlift", workouts, sets, "2026-11-16"))
        val history = exerciseHistory("Bench press", workouts, sets)
        assertEquals(65.0 to "2026-11-09", heaviestSet(history, "kg")!!.let { it.first.weight to it.second })
        assertEquals(135.0, heaviestSet(history, "lb")!!.first.weight)
        assertEquals(listOf("Bench press", "Squat"), loggedExercises(workouts, sets))
    }

    @Test fun draftsNeedSomething() {
        assertEquals(DraftValues(62.5, 8, null), draftSet("62,5", "8"))
        assertEquals(DraftValues(null, 12, null), draftSet("", "12"))
        assertNull(draftSet("", ""))
        assertNull(draftSet("-5", "abc"))
    }

    @Test fun exerciseLines() {
        assertEquals(PlannedExercise("Bench press", 3, 8, 60.0, null), parseExerciseLine("- Bench press: 3x8 @ 60kg"))
        assertEquals(PlannedExercise("Leg press", 4, 12, 100.5, null), parseExerciseLine("Leg press 4×12 100.5"))
        assertEquals(PlannedExercise("Plank", 3, null, null, 45), parseExerciseLine("- Plank: 3 x 45s"))
        assertEquals(PlannedExercise("Pull-up", 3, null, null, null), parseExerciseLine("1. Pull-up: 3 sets"))
        assertEquals(PlannedExercise("Stretching", 1), parseExerciseLine("- Stretching"))
        assertNull(parseExerciseLine("- "))
        for (line in listOf("Bench press: 3x8 @ 60", "Plank: 3x45s", "Pull-up: 3 sets")) assertEquals(line, exerciseLine(parseExerciseLine(line)!!))
    }

    @Test fun routinesFromMarkdown() {
        val routines = parseRoutinesMarkdown(
            listOf("# Push day", "Days: Sun, Wednesday", "Warm up 5 minutes first.", "- Bench press: 3x8 @ 60kg", "- Plank: 3x45s", "", "## Legs", "Days: Tue", "- Squat: 5x5 @ 80", "# Empty", "Days: Fri").joinToString("\n"),
        )
        assertEquals(2, routines.size)
        assertEquals("Push day", routines[0].name)
        assertEquals(listOf(0, 3), routines[0].weekdays)
        assertEquals("Warm up 5 minutes first.", routines[0].note)
        assertEquals(listOf("Bench press", "Plank"), routines[0].exercises.map { it.exercise })
        assertEquals(RoutineInput("Legs", listOf(2), listOf(PlannedExercise("Squat", 5, 5, 80.0)), null), routines[1])
        assertEquals(listOf(0, 4, 6), parseWeekdays("Sunday and thurs, sat"))
    }

    @Test fun routineDraftsUseThePlanOrLastTime() {
        val routine = WorkoutRoutine("r", "Legs", listOf(1), listOf(PlannedExercise("Squat", 3, 5, null), PlannedExercise("Plank", 2, null, null, 45)))
        val draft = routineDraft(routine) { if (it == "Squat") ExerciseSession("w", "2026-11-10", listOf(WorkoutSet("x", "w", "Squat", reps = 5, weight = 82.5))) else null }
        assertEquals(DraftExercise("Squat", List(3) { DraftRow("82.5", "5") }), draft[0])
        assertEquals(2, draft[1].rows.size)
        assertEquals("3 × 8 · 60 kg", plannedLabel(PlannedExercise("Bench", 3, 8, 60.0)))
        assertEquals("2 sets", plannedLabel(PlannedExercise("Pull-up", 2)))
        assertEquals(listOf("Arms", "Push"), routinesFor(listOf(WorkoutRoutine("1", "Push", listOf(0)), WorkoutRoutine("2", "Arms", listOf(0, 2)), WorkoutRoutine("3", "Legs", listOf(2))), 0).map { it.name })
    }
}
