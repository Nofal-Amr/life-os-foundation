import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap, writeWithColumnFallback } from "@/lib/supabase-helpers";

export type PrayerLog = Database["public"]["Tables"]["prayer_logs"]["Row"];
export type PrayerSettings = Database["public"]["Tables"]["prayer_settings"]["Row"];

export const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const CALC_METHODS = [
  { value: "MuslimWorldLeague", label: "Muslim World League" },
  { value: "Egyptian", label: "Egyptian General Authority" },
  { value: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { value: "UmmAlQura", label: "Umm al-Qura, Makkah" },
  { value: "Dubai", label: "Dubai" },
  { value: "MoonsightingCommittee", label: "Moonsighting Committee" },
  { value: "NorthAmerica", label: "ISNA (North America)" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Qatar", label: "Qatar" },
  { value: "Singapore", label: "Singapore" },
  { value: "Turkey", label: "Turkey" },
  { value: "Tehran", label: "Tehran" },
] as const;

export const ASR_SCHOOLS = [
  { value: "shafi", label: "Shafi, Maliki, Hanbali" },
  { value: "hanafi", label: "Hanafi" },
] as const;

export const spiritKeys = {
  settings: ["prayer_settings"] as const,
  logs: ["prayer_logs"] as const,
};

export const prayerSettingsQuery = () =>
  queryOptions({
    queryKey: spiritKeys.settings,
    queryFn: async () =>
      unwrap(
        await supabase.from("prayer_settings").select("*").maybeSingle(),
      ) as PrayerSettings | null,
  });

export const prayerLogsQuery = () =>
  queryOptions({
    queryKey: spiritKeys.logs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("prayer_logs")
          .select("*")
          .order("prayer_date", { ascending: false })
          .limit(2000),
      ) as PrayerLog[],
  });

export type PrayerSettingsInput = {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  calc_method?: string | null;
  asr_school?: string | null;
};

export async function savePrayerSettings(input: PrayerSettingsInput): Promise<PrayerSettings> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("prayer_settings")
      .upsert({ user_id, ...input }, { onConflict: "user_id" })
      .select()
      .single(),
  ) as PrayerSettings;
}

export async function logPrayer(input: {
  prayer_date: string;
  prayer_name: PrayerName;
  completed: boolean;
  on_time: boolean | null;
}): Promise<PrayerLog> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("prayer_logs")
      .upsert({ user_id, ...input }, { onConflict: "user_id,prayer_date,prayer_name" })
      .select()
      .single(),
  ) as PrayerLog;
}

export async function clearPrayerLog(prayer_date: string, prayer_name: PrayerName) {
  const { error } = await supabase
    .from("prayer_logs")
    .delete()
    .eq("prayer_date", prayer_date)
    .eq("prayer_name", prayer_name);
  if (error) throw error;
}

/** Geocode a city name with the free Open-Meteo geocoding endpoint. */
export async function geocodeCity(
  city: string,
): Promise<{ latitude: number; longitude: number; label: string }> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(city)}`,
  );
  if (!response.ok) throw new Error("Could not look up that place right now.");
  const payload = (await response.json()) as {
    results?: { latitude: number; longitude: number; name: string; country?: string }[];
  };
  const first = payload.results?.[0];
  if (!first) throw new Error("No place matched that name. Try a different spelling.");
  return {
    latitude: first.latitude,
    longitude: first.longitude,
    label: first.country ? `${first.name}, ${first.country}` : first.name,
  };
}

/** Best-effort reverse lookup so the saved location shows a place name. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!response.ok) throw new Error("lookup failed");
    const payload = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const place = payload.city || payload.locality || payload.principalSubdivision;
    if (place) return payload.countryName ? `${place}, ${payload.countryName}` : place;
  } catch {
    /* fall through to coordinates */
  }
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

/* ------------------------------- statuses ------------------------------ */

export const PRAYER_STATUSES = ["jamaah", "on_time", "late", "missed"] as const;
export type PrayerStatus = (typeof PRAYER_STATUSES)[number];

export const PRAYER_STATUS_LABELS: Record<PrayerStatus, string> = {
  jamaah: "In jamaah",
  on_time: "On time",
  late: "Late",
  missed: "Missed",
};

/** A log's status; rows from before statuses existed are read from completed/on_time. */
export function statusOf(log: PrayerLog | undefined | null): PrayerStatus | null {
  if (!log) return null;
  if (log.status && (PRAYER_STATUSES as readonly string[]).includes(log.status)) {
    return log.status as PrayerStatus;
  }
  if (!log.completed) return "missed";
  return log.on_time === false ? "late" : "on_time";
}

/** Records how a prayer was prayed, or clears it with null. */
export async function setPrayerStatus(
  prayer_date: string,
  prayer_name: PrayerName,
  status: PrayerStatus | null,
): Promise<void> {
  if (!status) return clearPrayerLog(prayer_date, prayer_name);
  const user_id = await currentUserId();
  const row = {
    user_id,
    prayer_date,
    prayer_name,
    status,
    // Kept in step for older screens and reports.
    completed: status !== "missed",
    on_time: status === "late" ? false : status === "missed" ? null : true,
  };
  unwrap(
    await writeWithColumnFallback(row, (input) =>
      supabase
        .from("prayer_logs")
        .upsert(input, { onConflict: "user_id,prayer_date,prayer_name" })
        .select()
        .single(),
    ),
  );
}

/** Status counts over a date range (inclusive), for the stats summary. */
export function prayerStatusCounts(
  logs: PrayerLog[],
  from: string,
  to: string,
): Record<PrayerStatus, number> & { logged: number } {
  const counts = { jamaah: 0, on_time: 0, late: 0, missed: 0, logged: 0 };
  for (const log of logs) {
    if (log.prayer_date < from || log.prayer_date > to) continue;
    const status = statusOf(log);
    if (!status) continue;
    counts[status] += 1;
    counts.logged += 1;
  }
  return counts;
}
