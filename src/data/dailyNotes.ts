import { addDays, format, parseISO } from "date-fns";

import type { Note } from "@/data/notes";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

/**
 * Daily notes, like Obsidian's: one note per day, titled with the date, that
 * you just open and type into. They are ordinary rows in `notes`, marked by a
 * `daily:YYYY-MM-DD` tag, so no table change is needed and they sync and work
 * offline like every other note.
 *
 * Each day's note has a fixed id worked out from the user and the date. Two
 * devices that both start today's note write the same row (an upsert), so a
 * day never ends up with two notes, and the last write wins.
 */
export const DAILY_TAG_PREFIX = "daily:";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime()) && format(parsed, "yyyy-MM-dd") === value;
}

export function dailyTag(date: string): string {
  return `${DAILY_TAG_PREFIX}${date}`;
}

/** The day a note belongs to, or null when it isn't a daily note. */
export function dailyDateOf(note: Pick<Note, "tags">): string | null {
  for (const tag of note.tags) {
    if (tag.startsWith(DAILY_TAG_PREFIX)) {
      const date = tag.slice(DAILY_TAG_PREFIX.length);
      if (isISODate(date)) return date;
    }
  }
  return null;
}

export function isDailyNote(note: Pick<Note, "tags">): boolean {
  return dailyDateOf(note) !== null;
}

/** A day's title, for example "Friday, 13 November 2026". */
export function dailyTitle(date: string): string {
  return format(parseISO(date), "EEEE, d MMMM yyyy");
}

/** The note for a day, if one was written. The newest wins if there are ever two. */
export function dailyNoteOn<T extends Pick<Note, "tags" | "updated_at">>(
  notes: T[],
  date: string,
): T | null {
  const tag = dailyTag(date);
  const found = notes.filter((note) => note.tags.includes(tag));
  if (!found.length) return null;
  return found.reduce((a, b) => (b.updated_at > a.updated_at ? b : a));
}

export function shiftDay(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Daily notes that contain the search words, newest day first. */
export function searchDailyNotes<T extends Pick<Note, "tags" | "body">>(
  notes: T[],
  term: string,
): { date: string; note: T; snippet: string }[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const results: { date: string; note: T; snippet: string }[] = [];
  for (const note of notes) {
    const date = dailyDateOf(note);
    const body = note.body ?? "";
    if (!date) continue;
    const at = body.toLowerCase().indexOf(q);
    if (at < 0) continue;
    const start = Math.max(0, at - 40);
    const end = Math.min(body.length, at + q.length + 60);
    const snippet =
      (start > 0 ? "…" : "") +
      body.slice(start, end).replace(/\s+/g, " ").trim() +
      (end < body.length ? "…" : "");
    results.push({ date, note, snippet });
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

/* -------------------------------------------------------- Fixed day ids */

// Any fixed UUID works as the namespace; this one is only for daily notes.
const NAMESPACE = "6f1c2d9e-3b7a-4c58-9e21-5d4a8b7c0f13";

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** An RFC 4122 version-5 UUID (name-based, SHA-1). */
export async function uuidV5(name: string, namespace = NAMESPACE): Promise<string> {
  const ns = uuidBytes(namespace);
  const text = new TextEncoder().encode(name);
  const input = new Uint8Array(ns.length + text.length);
  input.set(ns);
  input.set(text, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The same id for the same user and day, on every device. */
export function dailyNoteId(userId: string, date: string): Promise<string> {
  return uuidV5(`daily-note:${userId}:${date}`);
}

/**
 * Saves a day's note (creating it the first time). If the day already has a
 * note with a different id (made before ids were fixed), that one is updated.
 */
export async function saveDailyNote(
  date: string,
  body: string,
  existing?: Pick<Note, "id" | "tags"> | null,
): Promise<Note> {
  const user_id = await currentUserId();
  const id = existing?.id ?? (await dailyNoteId(user_id, date));
  const tags = existing?.tags?.includes(dailyTag(date)) ? existing.tags : [dailyTag(date)];
  const row: Database["public"]["Tables"]["notes"]["Insert"] = {
    id,
    user_id,
    title: dailyTitle(date),
    body,
    tags,
    updated_at: new Date().toISOString(),
  };
  return unwrap(
    await supabase.from("notes").upsert(row, { onConflict: "id" }).select().single(),
  ) as Note;
}
