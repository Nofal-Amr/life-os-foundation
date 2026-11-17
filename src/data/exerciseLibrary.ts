/**
 * The exercise library: 876 exercises with their equipment, the muscles they
 * work and how to do them, from free-exercise-db (public domain,
 * https://github.com/yuhonas/free-exercise-db). The text ships with Life OS
 * (public/exercises.json) and loads only when Gym asks for it. The two photos
 * per exercise load on demand from the same project, pinned to one commit.
 */
import { queryOptions } from "@tanstack/react-query";

export type LibraryExercise = {
  id: string;
  name: string;
  equipment: string | null;
  level: "beginner" | "intermediate" | "expert";
  category: string;
  primary: string[];
  secondary: string[];
  steps: string[];
  images: string[];
};

const SOURCE_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";

export const exerciseImageUrl = (path: string) =>
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SOURCE_COMMIT}/exercises/${path}`;

export const exerciseLibraryQuery = () =>
  queryOptions({
    queryKey: ["exercise-library"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<LibraryExercise[]> => {
      const response = await fetch("/exercises.json");
      if (!response.ok) throw new Error("Couldn't load the exercise library.");
      return (await response.json()) as LibraryExercise[];
    },
  });

export const MUSCLES = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
] as const;

export const EQUIPMENT = [
  "machine",
  "cable",
  "barbell",
  "dumbbell",
  "body only",
  "kettlebells",
  "bands",
  "e-z curl bar",
  "medicine ball",
  "exercise ball",
  "foam roll",
  "other",
] as const;

const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Exercises matching every word typed (in any order), and the muscle and
 * equipment if chosen. Names that start with the text come first.
 */
export function searchExercises(
  list: LibraryExercise[],
  filter: { text?: string; muscle?: string; equipment?: string },
  limit = 60,
): LibraryExercise[] {
  const words = fold(filter.text ?? "")
    .split(" ")
    .filter(Boolean);
  const start = fold(filter.text ?? "");
  const matches = list.filter((item) => {
    if (filter.muscle && !item.primary.includes(filter.muscle)) return false;
    if (filter.equipment && (item.equipment ?? "other") !== filter.equipment) return false;
    const name = fold(item.name);
    return words.every((word) => name.includes(word));
  });
  if (start) {
    matches.sort(
      (a, b) =>
        Number(!fold(a.name).startsWith(start)) - Number(!fold(b.name).startsWith(start)) ||
        a.name.length - b.name.length,
    );
  }
  return matches.slice(0, limit);
}

/** The library entry with this exact name, however it was typed. */
export function findExercise(
  list: LibraryExercise[] | undefined,
  name: string,
): LibraryExercise | null {
  if (!list) return null;
  const key = fold(name);
  return key ? (list.find((item) => fold(item.name) === key) ?? null) : null;
}
