import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type Food = Database["public"]["Tables"]["foods"]["Row"];
export type FoodLog = Database["public"]["Tables"]["food_logs"]["Row"];

export const MEALS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const;

export type Meal = (typeof MEALS)[number]["value"];

export const foodKeys = {
  foods: ["foods"] as const,
  logs: ["food_logs"] as const,
};

export const foodsQuery = () =>
  queryOptions({
    queryKey: foodKeys.foods,
    queryFn: async () =>
      unwrap(await supabase.from("foods").select("*").order("name", { ascending: true })) as Food[],
  });

export const foodLogsQuery = () =>
  queryOptions({
    queryKey: foodKeys.logs,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("food_logs")
          .select("*")
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(500),
      ) as FoodLog[],
  });

export type FoodInput = {
  name: string;
  serving_label: string | null;
  serving_grams: number | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  icon: string | null;
};

export async function createFood(input: FoodInput): Promise<Food> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("foods")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as Food;
}

export async function updateFood(id: string, input: Partial<FoodInput>): Promise<Food> {
  return unwrap(await supabase.from("foods").update(input).eq("id", id).select().single()) as Food;
}

export async function deleteFood(id: string): Promise<void> {
  unwrap(await supabase.from("foods").delete().eq("id", id).select());
}

export type FoodLogInput = {
  food_id: string | null;
  name: string | null;
  log_date: string;
  meal: string | null;
  servings: number;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/** Log a library food: the macro numbers are copied from the food row itself. */
export function logFromFood(
  food: Food,
  servings: number,
  log_date: string,
  meal: string | null,
): FoodLogInput {
  const scale = (value: number | null) => (value == null ? null : Number(value) * servings);
  return {
    food_id: food.id,
    name: food.name,
    log_date,
    meal,
    servings,
    calories: Number(food.calories) * servings,
    protein_g: scale(food.protein_g),
    carbs_g: scale(food.carbs_g),
    fat_g: scale(food.fat_g),
  };
}

export async function createFoodLog(input: FoodLogInput): Promise<FoodLog> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("food_logs")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as FoodLog;
}

export async function deleteFoodLog(id: string): Promise<void> {
  unwrap(await supabase.from("food_logs").delete().eq("id", id).select());
}

/** Totals are just the sum of the rows the user logged. */
export function dayTotals(logs: FoodLog[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return logs.reduce(
    (totals, log) => ({
      calories: totals.calories + Number(log.calories ?? 0),
      protein: totals.protein + Number(log.protein_g ?? 0),
      carbs: totals.carbs + Number(log.carbs_g ?? 0),
      fat: totals.fat + Number(log.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Recently and frequently logged foods, for one-tap chips. */
export function suggestedFoods(foods: Food[], logs: FoodLog[], limit = 8): Food[] {
  const score = new Map<string, number>();
  logs.forEach((log, index) => {
    if (!log.food_id) return;
    const recency = Math.max(0, 200 - index) / 100;
    score.set(log.food_id, (score.get(log.food_id) ?? 0) + 1 + recency);
  });
  return [...foods]
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The meal that fits the time of day, so logging needs no extra tap. */
export function mealForTime(date = new Date()): Meal {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

/**
 * One-off entries (typed names, no library food) logged before, newest
 * first and de-duplicated by name, so they can be repeated in one tap.
 */
export function recentOneOffs(logs: FoodLog[], limit = 6): FoodLog[] {
  const seen = new Set<string>();
  const out: FoodLog[] = [];
  for (const log of [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const name = log.name?.trim().toLowerCase();
    if (log.food_id || !name || seen.has(name)) continue;
    seen.add(name);
    out.push(log);
    if (out.length >= limit) break;
  }
  return out;
}
