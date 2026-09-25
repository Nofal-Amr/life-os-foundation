import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { todayISO } from "@/lib/date";
import { currentUserId, unwrap, writeWithColumnFallback } from "@/lib/supabase-helpers";

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
  category?: string | null;
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
  return unwrap(
    await writeWithColumnFallback({ ...input, user_id }, (row) =>
      supabase.from("habits").insert(row).select().single(),
    ),
  );
}

export async function updateHabit(id: string, input: Partial<HabitInput>) {
  return unwrap(
    await writeWithColumnFallback({ ...input }, (row) =>
      supabase.from("habits").update(row).eq("id", id).select().single(),
    ),
  );
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


export type DayDot = { date: string; logged: boolean };

/**
 * The last `days` days for one habit, oldest first, ending today. Only what
 * was logged is marked; a day without a log is just empty, not "missed".
 */
export function dayDots(logs: { log_date: string }[], today: string, days = 14): DayDot[] {
  const logged = new Set(logs.map((log) => log.log_date));
  const end = new Date(`${today}T12:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end);
    day.setDate(end.getDate() - (days - 1 - index));
    const date = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
    return { date, logged: logged.has(date) };
  });
}
