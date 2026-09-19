import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { todayISO } from "@/lib/date";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];
export type HabitInput = {
  name: string;
  description: string | null;
  frequency: Habit["frequency"];
  target: number;
  active: boolean;
  icon: string | null;
  color: string | null;
};

export const habitKeys = {
  all: ["habits"] as const,
  logs: ["habit_logs"] as const,
};

export const habitsQuery = () =>
  queryOptions({
    queryKey: habitKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("habits").select("*").order("created_at", { ascending: false }),
      ) as Habit[],
  });

export const habitLogsQuery = () =>
  queryOptions({
    queryKey: habitKeys.logs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("habit_logs")
          .select("*")
          .order("log_date", { ascending: false })
          .limit(500),
      ) as HabitLog[],
  });

export async function createHabit(input: HabitInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("habits").insert({ ...input, user_id }).select().single());
}

export async function updateHabit(id: string, input: Partial<HabitInput>) {
  return unwrap(await supabase.from("habits").update(input).eq("id", id).select().single());
}

export async function archiveHabit(id: string) {
  return updateHabit(id, { active: false });
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

export async function logHabit(habit_id: string, log_date = todayISO()) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase.from("habit_logs").insert({ habit_id, user_id, log_date }).select().single(),
  );
}

export async function unlogHabit(habit_id: string, log_date = todayISO()) {
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habit_id)
    .eq("log_date", log_date);
  if (error) throw error;
}

