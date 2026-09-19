import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

export const DIMENSIONS = [
  { value: "health", label: "Health" },
  { value: "spirit", label: "Spirit" },
  { value: "professional", label: "Professional" },
  { value: "discipline", label: "Discipline" },
  { value: "knowledge", label: "Knowledge" },
] as const;

export const DEFAULT_DIMENSION_ORDER = DIMENSIONS.map((d) => d.value) as string[];

export function dimensionLabel(value: string): string {
  return DIMENSIONS.find((d) => d.value === value)?.label ?? value;
}

export const preferencesKeys = { current: ["user_preferences"] as const };

export const preferencesQuery = () =>
  queryOptions({
    queryKey: preferencesKeys.current,
    queryFn: async () =>
      unwrap(
        await supabase.from("user_preferences").select("*").maybeSingle(),
      ) as UserPreferences | null,
  });

export type PreferencesInput = {
  dimension_order?: string[];
  unit_system?: string;
  time_format?: string;
  date_format?: string;
};

export async function savePreferences(input: PreferencesInput): Promise<UserPreferences> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("user_preferences")
      .upsert({ user_id, ...input }, { onConflict: "user_id" })
      .select()
      .single(),
  ) as UserPreferences;
}

export async function saveDimensionOrder(dimension_order: string[]): Promise<UserPreferences> {
  return savePreferences({ dimension_order });
}
