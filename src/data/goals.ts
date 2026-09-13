import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalInput = {
  name: string;
  description: string | null;
  category: string | null;
  target_date: string | null;
  status: Goal["status"];
  progress: number;
};

export const goalKeys = { all: ["goals"] as const };

export const goalsQuery = () =>
  queryOptions({
    queryKey: goalKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("goals").select("*").order("created_at", { ascending: false }),
      ) as Goal[],
  });

export async function createGoal(input: GoalInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("goals").insert({ ...input, user_id }).select().single());
}

export async function updateGoal(id: string, input: Partial<GoalInput>) {
  return unwrap(await supabase.from("goals").update(input).eq("id", id).select().single());
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
