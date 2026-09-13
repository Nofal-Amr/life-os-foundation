import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type CalendarEvent = Database["public"]["Tables"]["events"]["Row"];
export type EventInput = {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
};

export const eventKeys = { all: ["events"] as const };

export const eventsQuery = () =>
  queryOptions({
    queryKey: eventKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("events").select("*").order("start_at", { ascending: true }),
      ) as CalendarEvent[],
  });

export async function createEvent(input: EventInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("events").insert({ ...input, user_id }).select().single());
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  return unwrap(await supabase.from("events").update(input).eq("id", id).select().single());
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}
