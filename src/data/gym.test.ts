import { describe, expect, it } from "vitest";

import {
  draftSet,
  exerciseHistory,
  exerciseKey,
  exerciseSummary,
  heaviestSet,
  lastSession,
  loggedExercises,
  setLabel,
  type Workout,
  type WorkoutSet,
} from "./gym";

const workout = (id: string, day: string): Workout => ({
  id,
  user_id: "u",
  performed_on: day,
  name: null,
  note: null,
  created_at: "",
  updated_at: "",
});
let n = 0;
const set = (
  workoutId: string,
  exercise: string,
  weight: number | null,
  reps: number | null,
  unit: "kg" | "lb" = "kg",
): WorkoutSet => ({
  id: `s${n}`,
  user_id: "u",
  workout_id: workoutId,
  exercise,
  position: n++,
  reps,
  weight,
  unit,
  seconds: null,
  created_at: "",
});

const workouts = [
  workout("w1", "2026-11-02"),
  workout("w2", "2026-11-09"),
  workout("w3", "2026-11-16"),
];
const sets = [
  set("w1", "Bench press", 60, 8),
  set("w1", "Bench press", 60, 8),
  set("w1", "Squat", 80, 5),
  set("w2", "bench  Press", 62.5, 8),
  set("w2", "Bench press", 65, 6),
  set("w3", "Squat", 85, 5),
  set("w3", "Bench press", 135, 5, "lb"),
];

describe("gym", () => {
  it("labels sets plainly", () => {
    expect(setLabel({ weight: 62.5, reps: 8, unit: "kg", seconds: null })).toBe("62.5 kg × 8");
    expect(setLabel({ weight: null, reps: 12, unit: "kg", seconds: null })).toBe("× 12");
    expect(setLabel({ weight: null, reps: null, unit: "kg", seconds: 45 })).toBe("45 s");
  });

  it("treats an exercise the same however it was typed", () => {
    expect(exerciseKey("  bench  Press ")).toBe("bench press");
  });

  it("summarises a workout by exercise, folding identical sets", () => {
    expect(exerciseSummary(sets.filter((item) => item.workout_id === "w1"))).toEqual([
      { exercise: "Bench press", text: "2 × 60 kg × 8" },
      { exercise: "Squat", text: "80 kg × 5" },
    ]);
    expect(exerciseSummary(sets.filter((item) => item.workout_id === "w2"))).toEqual([
      { exercise: "bench  Press", text: "62.5 kg × 8, 65 kg × 6" },
    ]);
  });

  it("lists an exercise's sessions newest first", () => {
    expect(exerciseHistory("BENCH PRESS", workouts, sets).map((session) => session.day)).toEqual([
      "2026-11-16",
      "2026-11-09",
      "2026-11-02",
    ]);
  });

  it("finds the last time before the workout being logged", () => {
    expect(lastSession("Bench press", workouts, sets, "2026-11-16", "w3")?.day).toBe("2026-11-09");
    expect(lastSession("Deadlift", workouts, sets, "2026-11-16")).toBeNull();
  });

  it("finds the heaviest set in one unit, without converting the other", () => {
    const history = exerciseHistory("Bench press", workouts, sets);
    expect(heaviestSet(history, "kg")).toMatchObject({
      day: "2026-11-09",
      set: { weight: 65, reps: 6 },
    });
    expect(heaviestSet(history, "lb")).toMatchObject({ day: "2026-11-16", set: { weight: 135 } });
  });

  it("lists logged exercises, most recent first", () => {
    expect(loggedExercises(workouts, sets)).toEqual(["Bench press", "Squat"]);
  });

  it("reads a typed set, and refuses an empty one", () => {
    expect(draftSet({ weight: "62,5", reps: "8" })).toEqual({
      weight: 62.5,
      reps: 8,
      seconds: null,
    });
    expect(draftSet({ weight: "", reps: "12" })).toEqual({ weight: null, reps: 12, seconds: null });
    expect(draftSet({ weight: "", reps: "" })).toBeNull();
    expect(draftSet({ weight: "-5", reps: "abc" })).toBeNull();
  });
});
