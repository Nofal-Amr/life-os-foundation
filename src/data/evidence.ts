import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Evidence = Database["public"]["Tables"]["evidence"]["Row"];
export type EvidenceInput = {
  task_id: string | null;
  capability_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  note: string | null;
};

export const evidenceKeys = { all: ["evidence"] as const };

/** Append-only log: select and insert only. */
export const evidenceQuery = () =>
  queryOptions({
    queryKey: evidenceKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("evidence").select("*").order("created_at", { ascending: false }),
      ) as Evidence[],
  });

export async function createEvidence(input: EvidenceInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("evidence").insert({ ...input, user_id }).select().single());
}
