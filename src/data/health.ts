import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type BodyStats = Database["public"]["Tables"]["body_stats"]["Row"];
export type HealthLog = Database["public"]["Tables"]["health_logs"]["Row"];
export type Medication = Database["public"]["Tables"]["medications"]["Row"];
export type MedicationLog = Database["public"]["Tables"]["medication_logs"]["Row"];

export const FOOD_CATEGORIES = [
  "protein",
  "vegetables",
  "fruit",
  "grains",
  "dairy",
  "homecooked",
  "junk",
  "takeaway",
] as const;

export const healthKeys = {
  body: ["body_stats"] as const,
  logs: ["health_logs"] as const,
  medications: ["medications"] as const,
  medicationLogs: ["medication_logs"] as const,
};

export const bodyStatsQuery = () =>
  queryOptions({
    queryKey: healthKeys.body,
    queryFn: async () =>
      unwrap(await supabase.from("body_stats").select("*").maybeSingle()) as BodyStats | null,
  });

export const healthLogsQuery = () =>
  queryOptions({
    queryKey: healthKeys.logs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("health_logs")
          .select("*")
          .order("log_date", { ascending: false })
          .limit(30),
      ) as HealthLog[],
  });

export const medicationsQuery = () =>
  queryOptions({
    queryKey: healthKeys.medications,
    queryFn: async () =>
      unwrap(
        await supabase.from("medications").select("*").order("created_at", { ascending: true }),
      ) as Medication[],
  });

export const medicationLogsQuery = () =>
  queryOptions({
    queryKey: healthKeys.medicationLogs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("medication_logs")
          .select("*")
          .order("log_date", { ascending: false })
          .limit(200),
      ) as MedicationLog[],
  });

export type BodyStatsInput = {
  height_cm: number | null;
  weight_kg: number | null;
  birthdate: string | null;
  target_weight_kg: number | null;
  notes: string | null;
};

export async function saveBodyStats(input: Partial<BodyStatsInput>): Promise<BodyStats> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("body_stats")
      .upsert({ user_id, ...input }, { onConflict: "user_id" })
      .select()
      .single(),
  ) as BodyStats;
}

export type HealthLogInput = {
  log_date: string;
  trained: boolean | null;
  sleep_hours: number | null;
  stress_level: number | null;
  water_ok: boolean | null;
  food_quality: number | null;
  food_categories: string[] | null;
  mood: number | null;
  note: string | null;
};

export async function saveHealthLog(input: HealthLogInput): Promise<HealthLog> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("health_logs")
      .upsert({ user_id, ...input }, { onConflict: "user_id,log_date" })
      .select()
      .single(),
  ) as HealthLog;
}

export type MedicationInput = {
  name: string;
  dosage: string | null;
  schedule_times: string[] | null;
  notes: string | null;
  active: boolean;
};

export async function createMedication(input: MedicationInput): Promise<Medication> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase.from("medications").insert({ ...input, user_id }).select().single(),
  ) as Medication;
}

export async function updateMedication(
  id: string,
  input: Partial<MedicationInput>,
): Promise<Medication> {
  return unwrap(
    await supabase.from("medications").update(input).eq("id", id).select().single(),
  ) as Medication;
}

export async function deleteMedication(id: string) {
  const { error } = await supabase.from("medications").delete().eq("id", id);
  if (error) throw error;
}

export async function setDoseTaken(input: {
  medication_id: string;
  log_date: string;
  time_slot: string;
  taken: boolean;
}): Promise<MedicationLog> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("medication_logs")
      .upsert({ user_id, ...input }, { onConflict: "medication_id,log_date,time_slot" })
      .select()
      .single(),
  ) as MedicationLog;
}

/** BMI, rounded to one decimal. Returns null unless both values exist. */
export function bmi(height_cm: number | null, weight_kg: number | null): number | null {
  if (!height_cm || !weight_kg || height_cm <= 0) return null;
  const metres = height_cm / 100;
  return Math.round((weight_kg / (metres * metres)) * 10) / 10;
}
