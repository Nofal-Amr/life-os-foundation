/**
 * Reading and saving Gym rows. The tables come from
 * supabase/migrations/20261116120000_gym.sql; until that is applied a
 * database answers "table not found", which `isMissingTable` recognises so
 * the page can say so calmly instead of failing.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase-helpers";

import type { Workout, WorkoutSet } from "./gym";
import { isMissingTable } from "./relationshipsApi";

// The generated types don't have these tables until the migration is applied.
const table = (name: "workouts" | "workout_sets") => supabase.from(name as never);

export const gymKeys = {
  all: ["gym"] as const,
  workouts: ["gym", "workouts"] as const,
  sets: ["gym", "sets"] as const,
};

export const workoutsQuery = () =>
  queryOptions({
    queryKey: gymKeys.workouts,
    queryFn: async () =>
      unwrap(
        await table("workouts")
          .select("*")
          .order("performed_on", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as unknown as Workout[],
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });

export const workoutSetsQuery = () =>
  queryOptions({
    queryKey: gymKeys.sets,
    queryFn: async () =>
      unwrap(
        await table("workout_sets").select("*").order("position", { ascending: true }),
      ) as unknown as WorkoutSet[],
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });

export type NewSet = Pick<
  WorkoutSet,
  "exercise" | "position" | "reps" | "weight" | "unit" | "seconds"
>;

/** A workout and its sets. If the sets can't be saved, the empty workout is removed again. */
export async function logWorkout(
  workout: Pick<Workout, "performed_on" | "name" | "note">,
  sets: NewSet[],
): Promise<void> {
  const saved = unwrap(
    await table("workouts")
      .insert(workout as never)
      .select()
      .single(),
  ) as unknown as Workout;
  if (!sets.length) return;
  try {
    unwrap(
      await table("workout_sets")
        .insert(sets.map((set) => ({ ...set, workout_id: saved.id })) as never)
        .select(),
    );
  } catch (error) {
    await table("workouts").delete().eq("id", saved.id);
    throw error;
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  unwrap(await table("workouts").delete().eq("id", id).select());
}
