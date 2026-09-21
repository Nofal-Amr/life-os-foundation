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
  "steps" | "sleep" | "heart_rate" | "weight" | "exercise" | "active_calories";

export const HEALTH_KIND_LABELS: Record<HealthKind, string> = {
  steps: "Steps",
  sleep: "Sleep",
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
};

export async function syncHealthFromPhone(days = 30): Promise<HealthSyncReport> {
  const result = JSON.parse(await nativeRequest("readHealth", { days })) as NativeResult;
  if (result.error) throw new Error(result.error);
  const user_id = await currentUserId();
  const rows = (result.samples ?? []).map((sample) => ({ ...sample, user_id }));
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
  };
}

/** The local calendar day a sample belongs to (sleep counts for the day it ends). */
function dayOf(sample: HealthSample): string {
  const at = sample.kind === "sleep" && sample.end_at ? sample.end_at : sample.start_at;
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
    if (kind === "heart_rate") return list.reduce((sum, s) => sum + s.value, 0) / list.length;
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
