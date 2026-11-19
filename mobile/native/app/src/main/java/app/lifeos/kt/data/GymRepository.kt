package app.lifeos.kt.data

import app.lifeos.kt.core.model.Workout
import app.lifeos.kt.core.model.WorkoutRoutine
import app.lifeos.kt.core.model.WorkoutSet
import app.lifeos.kt.data.logic.DraftExercise
import app.lifeos.kt.data.logic.draftSet
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

/** Gym: workouts made of sets, and routines (what you mean to do). */
@Singleton
class GymRepository @Inject constructor(private val store: LocalStore) {
    val workouts: Flow<List<Workout>> = store.observe("workouts", Workout.serializer())
    val sets: Flow<List<WorkoutSet>> = store.observe("workout_sets", WorkoutSet.serializer())
    val routines: Flow<List<WorkoutRoutine>> = store.observe("workout_routines", WorkoutRoutine.serializer())

    /** Saves a workout and its sets; a set needs weight, reps or time. Replaces the sets of an existing one. */
    suspend fun saveWorkout(workout: Workout, exercises: List<DraftExercise>, unit: String, existingSets: List<WorkoutSet>) {
        store.save("workouts", Workout.serializer(), workout)
        existingSets.filter { it.workoutId == workout.id }.forEach { store.delete("workout_sets", it.id) }
        var position = 0
        for (exercise in exercises) {
            val name = exercise.name.trim().take(80)
            if (name.isEmpty()) continue
            for (row in exercise.rows) {
                val set = draftSet(row.weight, row.reps, row.seconds) ?: continue
                store.save("workout_sets", WorkoutSet.serializer(), WorkoutSet(newId(), workout.id, name, position++, set.reps, set.weight, unit, set.seconds))
            }
        }
    }

    /** A workout goes with its sets (the server does the same). */
    suspend fun deleteWorkout(workout: Workout, sets: List<WorkoutSet>) {
        sets.filter { it.workoutId == workout.id }.forEach { store.delete("workout_sets", it.id) }
        store.delete("workouts", workout.id)
    }

    suspend fun save(routine: WorkoutRoutine) = store.save("workout_routines", WorkoutRoutine.serializer(), routine)
    suspend fun delete(routine: WorkoutRoutine) = store.delete("workout_routines", routine.id)
}
