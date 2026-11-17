/**
 * Gym: workouts made of sets (exercise, weight, reps). Everything shown is
 * what was logged — the last time you did an exercise, your heaviest set, the
 * reps at a weight. No scores, no estimated maxes, no targets.
 */

export type Workout = {
  id: string;
  user_id: string;
  performed_on: string;
  name: string | null;
  note: string | null;
  /** The routine this workout followed, if any. */
  routine_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSet = {
  id: string;
  user_id: string;
  workout_id: string;
  exercise: string;
  position: number;
  reps: number | null;
  weight: number | null;
  unit: "kg" | "lb";
  seconds: number | null;
  created_at: string;
};

/** Common exercises, offered as suggestions; any name can be typed. */
export const EXERCISES = [
  "Bench press",
  "Incline bench press",
  "Dumbbell press",
  "Overhead press",
  "Squat",
  "Front squat",
  "Leg press",
  "Lunge",
  "Deadlift",
  "Romanian deadlift",
  "Hip thrust",
  "Pull-up",
  "Chin-up",
  "Lat pulldown",
  "Barbell row",
  "Dumbbell row",
  "Seated cable row",
  "Push-up",
  "Dip",
  "Biceps curl",
  "Hammer curl",
  "Triceps pushdown",
  "Lateral raise",
  "Face pull",
  "Leg curl",
  "Leg extension",
  "Calf raise",
  "Plank",
  "Crunch",
  "Running",
  "Cycling",
  "Rowing machine",
] as const;

/** The same exercise however it was typed: case and spacing don't matter. */
export const exerciseKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

const number = (value: number) =>
  Number.isInteger(value) ? String(value) : String(+value.toFixed(2));

/** "60 kg × 8", "× 12", "60 kg", "45 s". */
export function setLabel(set: Pick<WorkoutSet, "reps" | "weight" | "unit" | "seconds">): string {
  const parts: string[] = [];
  if (set.weight != null) parts.push(`${number(set.weight)} ${set.unit}`);
  if (set.reps != null) parts.push(`× ${set.reps}`);
  if (set.seconds != null) parts.push(`${set.seconds} s`);
  return parts.join(" ");
}

/**
 * A workout's exercises in the order first done, each with its sets, as
 * "Bench press: 60 kg × 8, 60 kg × 8, 65 kg × 6". Identical sets read as one
 * line: "3 × 60 kg × 8".
 */
export function exerciseSummary(sets: WorkoutSet[]): { exercise: string; text: string }[] {
  const groups = new Map<string, { exercise: string; sets: WorkoutSet[] }>();
  for (const set of [...sets].sort((a, b) => a.position - b.position)) {
    const key = exerciseKey(set.exercise);
    const group = groups.get(key) ?? { exercise: set.exercise.trim(), sets: [] };
    group.sets.push(set);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const labels = group.sets.map(setLabel);
    const same = labels.every((label) => label === labels[0]);
    return {
      exercise: group.exercise,
      text: same && labels.length > 1 ? `${labels.length} × ${labels[0]}` : labels.join(", "),
    };
  });
}

export type ExerciseSession = { workoutId: string; day: string; sets: WorkoutSet[] };

/** Every session of one exercise, newest first. */
export function exerciseHistory(
  exercise: string,
  workouts: Workout[],
  sets: WorkoutSet[],
): ExerciseSession[] {
  const key = exerciseKey(exercise);
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    if (exerciseKey(set.exercise) !== key) continue;
    byWorkout.set(set.workout_id, [...(byWorkout.get(set.workout_id) ?? []), set]);
  }
  return workouts
    .filter((workout) => byWorkout.has(workout.id))
    .map((workout) => ({
      workoutId: workout.id,
      day: workout.performed_on,
      sets: byWorkout.get(workout.id)!.sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.workoutId.localeCompare(a.workoutId));
}

/** The last session of an exercise before a day (to show "last time" while logging). */
export function lastSession(
  exercise: string,
  workouts: Workout[],
  sets: WorkoutSet[],
  beforeOrOn: string,
  excludeWorkoutId?: string,
): ExerciseSession | null {
  return (
    exerciseHistory(exercise, workouts, sets).find(
      (session) => session.day <= beforeOrOn && session.workoutId !== excludeWorkoutId,
    ) ?? null
  );
}

/**
 * The heaviest set logged for an exercise (most reps breaks a tie), in one
 * unit. Sets in the other unit are left out rather than converted.
 */
export function heaviestSet(
  sessions: ExerciseSession[],
  unit: "kg" | "lb",
): {
  set: WorkoutSet;
  day: string;
} | null {
  let best: { set: WorkoutSet; day: string } | null = null;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.weight == null || set.unit !== unit) continue;
      if (
        !best ||
        set.weight > best.set.weight! ||
        (set.weight === best.set.weight && (set.reps ?? 0) > (best.set.reps ?? 0))
      )
        best = { set, day: session.day };
    }
  }
  return best;
}

/** Distinct exercises you've logged, most recent first, for suggestions and progress. */
export function loggedExercises(workouts: Workout[], sets: WorkoutSet[]): string[] {
  const dayOf = new Map(workouts.map((workout) => [workout.id, workout.performed_on]));
  const latest = new Map<string, { name: string; day: string }>();
  for (const set of sets) {
    const key = exerciseKey(set.exercise);
    const day = dayOf.get(set.workout_id) ?? "";
    const seen = latest.get(key);
    if (!seen || day > seen.day) latest.set(key, { name: set.exercise.trim(), day });
  }
  return [...latest.values()]
    .sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name))
    .map((item) => item.name);
}

/** A draft set from what was typed: blanks are null, and a set needs reps, weight or time. */
export function draftSet(input: { weight: string; reps: string; seconds?: string }): {
  weight: number | null;
  reps: number | null;
  seconds: number | null;
} | null {
  const read = (text: string | undefined, max: number, integer: boolean) => {
    const value = Number((text ?? "").replace(",", ".").trim());
    if (!text?.trim() || !Number.isFinite(value) || value < 0 || value > max) return null;
    return integer ? Math.round(value) : value;
  };
  const set = {
    weight: read(input.weight, 2000, false),
    reps: read(input.reps, 1000, true),
    seconds: read(input.seconds, 86400, true),
  };
  return set.weight == null && set.reps == null && set.seconds == null ? null : set;
}
