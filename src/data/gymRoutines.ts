/**
 * Gym's plan side: routines ("Push day, Sun and Wed: bench 3 × 8 at 60 kg").
 * A routine is what you mean to do; a workout is what you did. Starting a
 * routine fills the log with its plan, and you change it to what happened.
 */
import type { ExerciseSession } from "./gym";

export type PlannedExercise = {
  exercise: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  seconds: number | null;
};

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  /** 0 = Sunday. Empty: any day. */
  weekdays: number[];
  exercises: PlannedExercise[];
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineInput = Pick<Routine, "name" | "weekdays" | "exercises" | "note">;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Routines planned for a weekday, in name order. */
export function routinesFor(routines: Routine[], weekday: number): Routine[] {
  return routines
    .filter((routine) => routine.weekdays.includes(weekday))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const num = (value: number) =>
  Number.isInteger(value) ? String(value) : String(+value.toFixed(2));

/** "3 × 8 · 60 kg", "3 × 45 s", "2 sets". */
export function plannedLabel(item: PlannedExercise, unit = "kg"): string {
  const parts = [
    item.reps != null
      ? `${item.sets} × ${item.reps}`
      : item.seconds != null
        ? `${item.sets} × ${item.seconds} s`
        : `${item.sets} ${item.sets === 1 ? "set" : "sets"}`,
  ];
  if (item.weight != null) parts.push(`${num(item.weight)} ${unit}`);
  return parts.join(" · ");
}

export type DraftRow = { weight: string; reps: string };
export type DraftExercise = { name: string; rows: DraftRow[] };

/**
 * The log's starting point for a routine: one row per planned set, with the
 * planned weight, or the weight from last time when the plan has none.
 */
export function routineDraft(
  routine: Pick<Routine, "exercises">,
  last: (exercise: string) => ExerciseSession | null,
): DraftExercise[] {
  return routine.exercises.map((item) => {
    const previous = last(item.exercise);
    const lastWeight = previous?.sets.find((set) => set.weight != null)?.weight ?? null;
    const weight = item.weight ?? lastWeight;
    const row: DraftRow = {
      weight: weight == null ? "" : num(weight),
      reps: item.reps == null ? "" : String(item.reps),
    };
    return {
      name: item.exercise,
      rows: Array.from({ length: Math.max(1, item.sets) }, () => ({ ...row })),
    };
  });
}

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

/** "Sun, Wed" / "Sunday and Wednesday" → [0, 3]. Unknown words are ignored. */
export function parseWeekdays(text: string): number[] {
  const days = new Set<number>();
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    const day = DAY_NAMES[word];
    if (day !== undefined) days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * One exercise line: "Bench press: 3x8 @ 60kg", "Plank: 3 x 45s",
 * "Leg press 4×12 100", "Pull-up: 3 sets". Returns null if no name.
 */
export function parseExerciseLine(line: string): PlannedExercise | null {
  const text = line.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, "").trim();
  if (!text) return null;
  const scheme = /(\d+)\s*[x×]\s*(\d+)\s*(s|sec|secs|seconds)?\b/i.exec(text);
  const setsOnly = scheme ? null : /(\d+)\s*sets?\b/i.exec(text);
  const cut = scheme?.index ?? setsOnly?.index ?? text.length;
  const name = text
    .slice(0, cut)
    .replace(/[:\-–—,]+\s*$/, "")
    .trim();
  if (!name) return null;
  const rest = text.slice(cut + (scheme?.[0].length ?? setsOnly?.[0].length ?? 0));
  const weightMatch = /(?:@|at)?\s*(\d+(?:[.,]\d+)?)\s*(kg|lb|lbs)?/i.exec(rest);
  const weight = weightMatch ? Number(weightMatch[1]!.replace(",", ".")) : null;
  const timed = !!scheme?.[3];
  return {
    exercise: name.slice(0, 80),
    sets: Math.min(20, Number(scheme?.[1] ?? setsOnly?.[1] ?? 1)),
    reps: scheme && !timed ? Number(scheme[2]) : null,
    seconds: scheme && timed ? Number(scheme[2]) : null,
    weight: weight != null && Number.isFinite(weight) ? weight : null,
  };
}

/**
 * Routines from Markdown. Each "#" or "##" heading starts a routine; a
 * "Days:" line sets its weekdays; list lines are its exercises; any other
 * line becomes its note.
 *
 *     # Push day
 *     Days: Sun, Wed
 *     - Bench press: 3x8 @ 60kg
 *     - Plank: 3x45s
 */
export function parseRoutinesMarkdown(markdown: string): RoutineInput[] {
  const routines: RoutineInput[] = [];
  let current: RoutineInput | null = null;
  const notes: string[] = [];
  const close = () => {
    if (current) {
      current.note = notes.join("\n").trim().slice(0, 2000) || null;
      if (current.exercises.length) routines.push(current);
    }
    notes.length = 0;
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,3}\s+(.+)$/.exec(line);
    if (heading) {
      close();
      current = { name: heading[1]!.trim().slice(0, 80), weekdays: [], exercises: [], note: null };
      continue;
    }
    if (!current || !line) continue;
    const days = /^days?\s*:\s*(.+)$/i.exec(line);
    if (days) {
      current.weekdays = parseWeekdays(days[1]!);
      continue;
    }
    if (/^(?:[-*+]|\d+[.)])\s+/.test(line)) {
      const item = parseExerciseLine(line);
      if (item) current.exercises.push(item);
      continue;
    }
    notes.push(line);
  }
  close();
  return routines;
}
