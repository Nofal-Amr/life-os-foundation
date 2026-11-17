import { describe, expect, it } from "vitest";

import { searchExercises, findExercise, type LibraryExercise } from "./exerciseLibrary";
import {
  parseExerciseLine,
  parseRoutinesMarkdown,
  parseWeekdays,
  plannedLabel,
  routineDraft,
  routinesFor,
  type Routine,
} from "./gymRoutines";

describe("parseExerciseLine", () => {
  it("reads sets, reps and weight", () => {
    expect(parseExerciseLine("- Bench press: 3x8 @ 60kg")).toEqual({
      exercise: "Bench press",
      sets: 3,
      reps: 8,
      seconds: null,
      weight: 60,
    });
    expect(parseExerciseLine("Leg press 4×12 100.5")).toMatchObject({
      exercise: "Leg press",
      sets: 4,
      reps: 12,
      weight: 100.5,
    });
  });

  it("reads timed sets and sets with no reps", () => {
    expect(parseExerciseLine("- Plank: 3 x 45s")).toMatchObject({
      sets: 3,
      seconds: 45,
      reps: null,
    });
    expect(parseExerciseLine("1. Pull-up: 3 sets")).toMatchObject({
      exercise: "Pull-up",
      sets: 3,
      reps: null,
      weight: null,
    });
    expect(parseExerciseLine("- Stretching")).toMatchObject({ exercise: "Stretching", sets: 1 });
    expect(parseExerciseLine("- ")).toBeNull();
  });
});

describe("parseRoutinesMarkdown", () => {
  it("makes a routine per heading with its days, exercises and note", () => {
    const routines = parseRoutinesMarkdown(
      [
        "# Push day",
        "Days: Sun, Wednesday",
        "Warm up 5 minutes first.",
        "- Bench press: 3x8 @ 60kg",
        "- Plank: 3x45s",
        "",
        "## Legs",
        "Days: Tue",
        "- Squat: 5x5 @ 80",
        "# Empty",
        "Days: Fri",
      ].join("\n"),
    );
    expect(routines).toHaveLength(2);
    expect(routines[0]).toMatchObject({
      name: "Push day",
      weekdays: [0, 3],
      note: "Warm up 5 minutes first.",
    });
    expect(routines[0]!.exercises.map((item) => item.exercise)).toEqual(["Bench press", "Plank"]);
    expect(routines[1]).toMatchObject({ name: "Legs", weekdays: [2], note: null });
  });

  it("reads day names in any form", () => {
    expect(parseWeekdays("Sunday and thurs, sat")).toEqual([0, 4, 6]);
  });
});

describe("routines for a day and the log's starting point", () => {
  const routine = (name: string, weekdays: number[]): Routine => ({
    id: name,
    user_id: "u",
    name,
    weekdays,
    exercises: [
      { exercise: "Squat", sets: 3, reps: 5, weight: null, seconds: null },
      { exercise: "Plank", sets: 2, reps: null, weight: null, seconds: 45 },
    ],
    note: null,
    created_at: "",
    updated_at: "",
  });

  it("picks the day's routines", () => {
    const list = [routine("Legs", [2]), routine("Push", [0, 3]), routine("Arms", [0])];
    expect(routinesFor(list, 0).map((item) => item.name)).toEqual(["Arms", "Push"]);
  });

  it("fills one row per planned set, taking last time's weight when the plan has none", () => {
    const draft = routineDraft(routine("Legs", [2]), (exercise) =>
      exercise === "Squat"
        ? {
            workoutId: "w",
            day: "2026-11-10",
            sets: [
              {
                id: "s",
                user_id: "u",
                workout_id: "w",
                exercise: "Squat",
                position: 0,
                reps: 5,
                weight: 82.5,
                unit: "kg",
                seconds: null,
                created_at: "",
              },
            ],
          }
        : null,
    );
    expect(draft[0]).toEqual({ name: "Squat", rows: Array(3).fill({ weight: "82.5", reps: "5" }) });
    expect(draft[1]!.rows).toHaveLength(2);
  });

  it("labels a plan line", () => {
    expect(plannedLabel({ exercise: "Bench", sets: 3, reps: 8, weight: 60, seconds: null })).toBe(
      "3 × 8 · 60 kg",
    );
    expect(
      plannedLabel({ exercise: "Plank", sets: 3, reps: null, weight: null, seconds: 45 }),
    ).toBe("3 × 45 s");
  });
});

describe("exercise library search", () => {
  const item = (name: string, primary: string[], equipment: string | null): LibraryExercise => ({
    id: name,
    name,
    equipment,
    level: "beginner",
    category: "strength",
    primary,
    secondary: [],
    steps: [],
    images: [],
  });
  const list = [
    item("Incline Dumbbell Press", ["chest"], "dumbbell"),
    item("Leg Press", ["quadriceps"], "machine"),
    item("Dumbbell Bench Press", ["chest"], "dumbbell"),
    item("Machine Bench Press", ["chest"], "machine"),
  ];

  it("matches every word in any order, names starting with the text first", () => {
    expect(searchExercises(list, { text: "press bench" }).map((e) => e.name)).toEqual([
      "Machine Bench Press",
      "Dumbbell Bench Press",
    ]);
    expect(searchExercises(list, { text: "dumbbell" }).map((e) => e.name)).toEqual([
      "Dumbbell Bench Press",
      "Incline Dumbbell Press",
    ]);
    expect(searchExercises(list, { text: "leg" }).map((e) => e.name)).toEqual(["Leg Press"]);
  });

  it("filters by muscle and equipment", () => {
    expect(
      searchExercises(list, { muscle: "chest", equipment: "machine" }).map((e) => e.name),
    ).toEqual(["Machine Bench Press"]);
  });

  it("finds an exercise by name however it was typed", () => {
    expect(findExercise(list, "  leg   PRESS ")?.name).toBe("Leg Press");
    expect(findExercise(list, "Squat")).toBeNull();
  });
});
