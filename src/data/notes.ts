import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { currentUserId, unwrap, writeWithColumnFallback } from "@/lib/supabase-helpers";

export type Note = Database["public"]["Tables"]["notes"]["Row"];

export type ChecklistItem = { id: string; text: string; done: boolean };

export type NoteInput = {
  title: string;
  body: string | null;
  tags: string[];
  pinned?: boolean;
  archived?: boolean;
  color?: string | null;
  /** When set, the note is a checklist and `body` is unused. */
  checklist?: ChecklistItem[] | null;
};

/** Keep-style note colours, drawn from the app's entity palette in both themes. */
export const NOTE_COLORS = [
  { key: "coral", label: "Coral", var: "--entity-coral" },
  { key: "amber", label: "Sand", var: "--entity-amber" },
  { key: "green", label: "Sage", var: "--entity-green" },
  { key: "teal", label: "Mint", var: "--entity-teal" },
  { key: "blue", label: "Sky", var: "--entity-blue" },
  { key: "violet", label: "Dusk", var: "--entity-violet" },
  { key: "rose", label: "Blossom", var: "--entity-rose" },
  { key: "slate", label: "Storm", var: "--entity-slate" },
] as const;

export function noteBackground(color: string | null | undefined): string | undefined {
  const entry = NOTE_COLORS.find((c) => c.key === color);
  return entry ? `color-mix(in oklch, var(${entry.var}) 18%, var(--color-card))` : undefined;
}

export function checklistOf(note: Pick<Note, "checklist">): ChecklistItem[] | null {
  return Array.isArray(note.checklist) ? (note.checklist as unknown as ChecklistItem[]) : null;
}

export function isEmptyNote(input: Pick<NoteInput, "title" | "body" | "checklist">): boolean {
  return (
    !input.title.trim() &&
    !(input.body ?? "").trim() &&
    !(input.checklist ?? []).some((item) => item.text.trim())
  );
}

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
      (checklistOf(n) ?? []).some((item) => item.text.toLowerCase().includes(q)) ||
      n.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toRow(input: Partial<NoteInput>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...input };
  if ("checklist" in input) row["checklist"] = (input.checklist ?? null) as unknown as Json;
  return row;
}

export async function createNote(input: NoteInput & { id?: string }): Promise<Note> {
  const user_id = await currentUserId();
  return unwrap(
    await writeWithColumnFallback({ ...toRow(input), user_id }, (row) =>
      supabase
        .from("notes")
        .insert(row as Database["public"]["Tables"]["notes"]["Insert"])
        .select()
        .single(),
    ),
  ) as Note;
}

export async function updateNote(id: string, input: Partial<NoteInput>): Promise<Note> {
  return unwrap(
    await writeWithColumnFallback(toRow(input), (row) =>
      supabase
        .from("notes")
        .update(row as Database["public"]["Tables"]["notes"]["Update"])
        .eq("id", id)
        .select()
        .single(),
    ),
  ) as Note;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
