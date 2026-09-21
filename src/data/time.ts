/**
 * Time tracking: activities you define and time entries against an activity
 * or a task. The entry with no ended_at is the running timer (one per user).
 * Totals are plain sums of logged minutes; nothing is judged.
 */
import { queryOptions } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];

export const timeKeys = {
  activities: ["activities"] as const,
  entries: ["time_entries"] as const,
};

/** Suggestions for a first set of activities; each can be renamed or archived. */
export const STARTER_ACTIVITIES: { name: string; icon: string; color: string }[] = [
  { name: "Gaming", icon: "gamepad-2", color: "var(--entity-violet)" },
  { name: "Reading", icon: "book-open", color: "var(--entity-amber)" },
  { name: "Learning", icon: "graduation-cap", color: "var(--entity-blue)" },
  { name: "Social", icon: "users", color: "var(--entity-rose)" },
  { name: "Hobby", icon: "palette", color: "var(--entity-teal)" },
  { name: "Exercise", icon: "dumbbell", color: "var(--entity-green)" },
];

export const activitiesQuery = () =>
  queryOptions({
    queryKey: timeKeys.activities,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("activities")
          .select("*")
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ) as Activity[],
  });

/** The last 90 days of entries plus any running timer. */
export const timeEntriesQuery = () =>
  queryOptions({
    queryKey: timeKeys.entries,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("time_entries")
          .select("*")
          .gte("started_at", addDays(new Date(), -90).toISOString())
          .order("started_at", { ascending: false }),
      ) as TimeEntry[],
  });

export async function createActivity(input: {
  name: string;
  icon: string | null;
  color: string | null;
  position?: number;
}) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("activities")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as Activity;
}

export async function updateActivity(
  id: string,
  input: Partial<Pick<Activity, "name" | "icon" | "color" | "archived">>,
) {
  return unwrap(
    await supabase.from("activities").update(input).eq("id", id).select().single(),
  ) as Activity;
}

export async function addStarterActivities() {
  const user_id = await currentUserId();
  unwrap(
    await supabase
      .from("activities")
      .insert(STARTER_ACTIVITIES.map((activity, position) => ({ ...activity, position, user_id })))
      .select(),
  );
}

export type TimerTarget = { activity_id: string | null; task_id: string | null; label: string };

/** Starts a timer, stopping any running one first. */
export async function startTimer(
  target: TimerTarget,
  running: TimeEntry | null,
): Promise<TimeEntry> {
  const now = new Date().toISOString();
  if (running) await stopTimer(running.id, now);
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("time_entries")
      .insert({ ...target, user_id, started_at: now, ended_at: null })
      .select()
      .single(),
  ) as TimeEntry;
}

export async function stopTimer(id: string, at = new Date().toISOString()) {
  return unwrap(
    await supabase.from("time_entries").update({ ended_at: at }).eq("id", id).select().single(),
  ) as TimeEntry;
}

/** Time logged after the fact: a start and a length. */
export async function logTime(
  input: TimerTarget & { started_at: string; minutes: number; note: string | null },
) {
  const user_id = await currentUserId();
  const { minutes, ...rest } = input;
  const ended_at = new Date(new Date(input.started_at).getTime() + minutes * 60_000).toISOString();
  return unwrap(
    await supabase
      .from("time_entries")
      .insert({ ...rest, user_id, ended_at })
      .select()
      .single(),
  ) as TimeEntry;
}

export async function deleteTimeEntry(id: string) {
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ Pure helpers */

export function runningEntry(entries: TimeEntry[]): TimeEntry | null {
  return entries.find((entry) => entry.ended_at == null) ?? null;
}

/** Whole minutes in an entry; a running one counts up to `now`. */
export function entryMinutes(
  entry: Pick<TimeEntry, "started_at" | "ended_at">,
  now = Date.now(),
): number {
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
  return Math.max(0, Math.round((end - new Date(entry.started_at).getTime()) / 60_000));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** "01:02:03" for a running clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** The key an entry is grouped under: its activity, or its task. */
export function entryKey(entry: TimeEntry): string {
  return entry.activity_id
    ? `a:${entry.activity_id}`
    : entry.task_id
      ? `t:${entry.task_id}`
      : `l:${entry.label ?? ""}`;
}

/** Minutes per local day between `from` and `to` (inclusive), by the day each entry started. */
export function minutesByDay(entries: TimeEntry[], days: string[], now = Date.now()): number[] {
  const index = new Map(days.map((day, i) => [day, i]));
  const totals = days.map(() => 0);
  for (const entry of entries) {
    const day = format(new Date(entry.started_at), "yyyy-MM-dd");
    const i = index.get(day);
    if (i != null) totals[i]! += entryMinutes(entry, now);
  }
  return totals;
}

/** Minutes per key (activity or task) for entries started on the given days. */
export function minutesByKey(
  entries: TimeEntry[],
  days: string[],
  now = Date.now(),
): Map<string, number> {
  const inRange = new Set(days);
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (!inRange.has(format(new Date(entry.started_at), "yyyy-MM-dd"))) continue;
    totals.set(entryKey(entry), (totals.get(entryKey(entry)) ?? 0) + entryMinutes(entry, now));
  }
  return totals;
}

/** Total minutes tracked against each task, all time in the loaded range. */
export function minutesByTask(entries: TimeEntry[], now = Date.now()): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.task_id) continue;
    totals.set(entry.task_id, (totals.get(entry.task_id) ?? 0) + entryMinutes(entry, now));
  }
  return totals;
}

export function daysEnding(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    format(addDays(parseISO(today), i - count + 1), "yyyy-MM-dd"),
  );
}
