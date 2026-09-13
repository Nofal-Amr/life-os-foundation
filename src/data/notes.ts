import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type NoteInput = {
  title: string;
  body: string | null;
  tags: string[];
};

export const noteKeys = { all: ["notes"] as const };

export const notesQuery = () =>
  queryOptions({
    queryKey: noteKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      ) as Note[],
  });

export function searchNotes(notes: Note[], term: string): Note[] {
  const q = term.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      (n.body ?? "").toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function createNote(input: NoteInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from("notes").insert({ ...input, user_id }).select().single());
}

export async function updateNote(id: string, input: Partial<NoteInput>) {
  return unwrap(await supabase.from("notes").update(input).eq("id", id).select().single());
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
