import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Capability = Database["public"]["Tables"]["capabilities"]["Row"];
export type CapabilityInput = {
  name: string;
  description: string | null;
};

export const capabilityKeys = { all: ["capabilities"] as const };

export const capabilitiesQuery = () =>
  queryOptions({
    queryKey: capabilityKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("capabilities").select("*").order("created_at", { ascending: false }),
      ) as Capability[],
  });

export async function createCapability(input: CapabilityInput) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase.from("capabilities").insert({ ...input, user_id }).select().single(),
  );
}

export async function updateCapability(id: string, input: Partial<CapabilityInput>) {
  return unwrap(await supabase.from("capabilities").update(input).eq("id", id).select().single());
}

export async function deleteCapability(id: string) {
  const { error } = await supabase.from("capabilities").delete().eq("id", id);
  if (error) throw error;
}
