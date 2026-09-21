/**
 * Samsung Health data, read on the phone through Health Connect and stored in
 * health_samples so the website shows it too. One row per Health Connect
 * record; re-syncing the same record updates it instead of duplicating it.
 */
import { queryOptions } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { nativeRequest } from "@/lib/native";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type HealthSample = Database["public"]["Tables"]["health_samples"]["Row"];
export type HealthKind =
  "steps" | "sleep" | "sleep_score" | "heart_rate" | "weight" | "exercise" | "active_calories";

export const HEALTH_KIND_LABELS: Record<HealthKind, string> = {
  steps: "Steps",
  sleep: "Sleep",
  sleep_score: "Sleep score",
  heart_rate: "Heart rate",
  weight: "Weight",
  exercise: "Exercise",
  active_calories: "Active calories",
};

export const healthSampleKeys = { all: ["health_samples"] as const };

export const healthSamplesQuery = (days = 30) =>
  queryOptions({
    queryKey: [...healthSampleKeys.all, days],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("health_samples")
          .select("*")
          .gte("start_at", addDays(new Date(), -days).toISOString())
          .order("start_at", { ascending: false })
          .limit(10000),
      ) as HealthSample[],
  });

type NativeSample = Omit<HealthSample, "id" | "user_id" | "created_at">;
type NativeResult = {
  samples?: NativeSample[];
  missing?: string[];
  errors?: string[];
  error?: string;
  diagnostics?: Record<string, unknown>;
};

const LAST_SYNC_KEY = "life-os-health-last-sync";

export function lastHealthSync(): Date | null {
  try {
    const value = localStorage.getItem(LAST_SYNC_KEY);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
}

/** Reads the last `days` days from the phone and saves them. Returns rows saved. */
export type HealthSyncReport = {
  saved: number;
  /** Records read per kind, e.g. { steps: 120 }. */
  byKind: Record<string, number>;
  /** Apps the records came from (Samsung Health is com.sec.android.app.shealth). */
  sources: string[];
  /** Health Connect read permissions Life OS doesn't have. */
  missing: string[];
  /** Errors Health Connect returned per data type. */
  errors: string[];
  /** Device, Health Connect and per-type facts, for troubleshooting. */
  diagnostics: Record<string, unknown>;
};

export async function syncHealthFromPhone(days = 30): Promise<HealthSyncReport> {
  const result = JSON.parse(await nativeRequest("readHealth", { days })) as NativeResult;
  if (result.error) throw new Error(result.error);
  const user_id = await currentUserId();
  const rows = (result.samples ?? []).map((sample) => ({ ...sample, user_id }));
  // A day's steps never go down: an import (phone + watch) may already hold a
  // higher total than what Health Connect has for that day.
  const stepIds = rows.filter((row) => row.kind === "steps").map((row) => row.external_id);
  if (stepIds.length) {
    const { data: existing } = await supabase
      .from("health_samples")
      .select("external_id, value")
      .eq("kind", "steps")
      .in("external_id", stepIds);
    const saved = new Map((existing ?? []).map((row) => [row.external_id, Number(row.value)]));
    for (const row of rows) {
      if (row.kind === "steps") row.value = Math.max(row.value, saved.get(row.external_id) ?? 0);
    }
  }
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await supabase
      .from("health_samples")
      .upsert(rows.slice(index, index + 500), { onConflict: "user_id,kind,external_id" });
    if (error) throw error;
  }
  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // Not remembered; the next sync simply runs again.
  }
  const byKind: Record<string, number> = {};
  for (const row of rows) byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
  return {
    saved: rows.length,
    byKind,
    sources: [...new Set(rows.map((row) => row.source).filter((s): s is string => !!s))],
    missing: result.missing ?? [],
    errors: result.errors ?? [],
    diagnostics: result.diagnostics ?? {},
  };
}

/** The local calendar day a sample belongs to (sleep counts for the day it ends). */
function dayOf(sample: HealthSample): string {
  const night = sample.kind === "sleep" || sample.kind === "sleep_score";
  const at = night && sample.end_at ? sample.end_at : sample.start_at;
  return format(new Date(at), "yyyy-MM-dd");
}

/**
 * One value per day for a kind: totals for steps, sleep, exercise and
 * calories; the average for heart rate; the latest reading for weight.
 */
export function dailyValues(
  samples: HealthSample[],
  kind: HealthKind,
  days: string[],
): (number | null)[] {
  const byDay = new Map<string, HealthSample[]>();
  for (const sample of samples) {
    if (sample.kind !== kind) continue;
    const day = dayOf(sample);
    byDay.set(day, [...(byDay.get(day) ?? []), sample]);
  }
  return days.map((day) => {
    const list = byDay.get(day);
    if (!list?.length) return null;
    if (kind === "heart_rate" || kind === "sleep_score") {
      return list.reduce((sum, s) => sum + s.value, 0) / list.length;
    }
    if (kind === "weight") {
      return [...list].sort((a, b) => b.start_at.localeCompare(a.start_at))[0]!.value;
    }
    return list.reduce((sum, s) => sum + s.value, 0);
  });
}

export function lastDays(count: number, today: string): string[] {
  return Array.from({ length: count }, (_, index) =>
    format(addDays(parseISO(today), index - count + 1), "yyyy-MM-dd"),
  );
}

/**
 * Adds Samsung Health days to a hand-logged series (e.g. sleep hours on the
 * Health page). A day logged by hand wins; Samsung fills the other days.
 */
export function withSampleDays(
  manual: { date: string; value: number }[],
  samples: HealthSample[],
  kind: HealthKind,
  days: number,
  toValue: (value: number) => number = (value) => value,
  today: Date = new Date(),
): { date: string; value: number }[] {
  const range = lastDays(days, format(today, "yyyy-MM-dd"));
  const logged = new Set(manual.map((point) => point.date));
  const extra = dailyValues(samples, kind, range)
    .map((value, index) => ({ date: range[index]!, value }))
    .filter((point): point is { date: string; value: number } => point.value != null)
    .filter((point) => !logged.has(point.date))
    .map((point) => ({ date: point.date, value: toValue(point.value) }));
  return [...manual, ...extra].sort((a, b) => a.date.localeCompare(b.date));
}
