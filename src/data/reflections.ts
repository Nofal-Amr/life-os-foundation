import { createNote, type Note } from "@/data/notes";
import type { DailyReview } from "@/data/reviews";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

/**
 * Quick reflections: one thing at a time, whenever it happens. Good things,
 * hard things and gratitude are added as lines to that day's review, so the
 * day's review is the compiled day. Ideas and notes go to Notes (tagged), and
 * the day's review lists them too.
 */
export type ReflectionKind = "good" | "hard" | "grateful" | "idea" | "note";

export const REFLECTION_KINDS: { kind: ReflectionKind; label: string; placeholder: string }[] = [
  { kind: "good", label: "Good thing", placeholder: "Something that went well" },
  { kind: "hard", label: "Hard thing", placeholder: "Something that was hard" },
  { kind: "grateful", label: "Grateful for", placeholder: "Something you're grateful for" },
  { kind: "idea", label: "Idea", placeholder: "An idea worth keeping" },
  { kind: "note", label: "Note", placeholder: "Anything to remember" },
];

/** The review column each kind adds to; ideas and notes are Notes instead. */
export const REVIEW_FIELD = {
  good: "wins",
  hard: "challenges",
  grateful: "gratitude",
} as const;

/** The tag that marks a note as an idea or a note from a reflection. */
export const REFLECTION_TAG = { idea: "idea", note: "reflection" } as const;

/** Adds one line to a field, keeping what's there. */
export function appendLine(existing: string | null | undefined, line: string): string {
  const text = line.trim();
  const before = (existing ?? "").replace(/\s+$/, "");
  return before ? `${before}\n${text}` : text;
}

/** The lines of a review field, one reflection each. */
export function linesOf(value: string | null | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** How many reflections a day holds: lines in the review, plus that day's ideas and notes. */
export function reflectionCount(
  review: Pick<DailyReview, "wins" | "challenges" | "gratitude"> | null | undefined,
  notes: Pick<Note, "tags" | "created_at">[] = [],
  date?: string,
): number {
  const lines = review
    ? [review.wins, review.challenges, review.gratitude].flatMap(linesOf).length
    : 0;
  return lines + (date ? reflectionNotesOn(notes, date).length : 0);
}

/** Ideas and notes captured as reflections on a given day (local date), in the order they came. */
export function reflectionNotesOn<T extends Pick<Note, "tags" | "created_at">>(
  notes: T[],
  date: string,
): T[] {
  const tags: string[] = Object.values(REFLECTION_TAG);
  return notes
    .filter((note) => {
      if (!note.tags.some((tag) => tags.includes(tag))) return false;
      const created = new Date(note.created_at);
      const local = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      return local === date;
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Saves one reflection for the given day. */
export async function addReflection(date: string, kind: ReflectionKind, text: string) {
  const line = text.trim();
  if (!line) return;
  if (kind === "idea" || kind === "note") {
    await createNote({ title: "", body: line, tags: [REFLECTION_TAG[kind]] });
    return;
  }
  const field = REVIEW_FIELD[kind];
  const user_id = await currentUserId();
  // Read the day fresh, so a line written on another device isn't lost.
  const current = unwrap(
    await supabase.from("daily_reviews").select(field).eq("review_date", date).maybeSingle(),
  ) as Partial<DailyReview> | null;
  const row: Database["public"]["Tables"]["daily_reviews"]["Insert"] = {
    review_date: date,
    user_id,
  };
  row[field] = appendLine(current?.[field], line);
  return unwrap(
    await supabase
      .from("daily_reviews")
      .upsert(row, { onConflict: "user_id,review_date" })
      .select()
      .single(),
  ) as DailyReview;
}
