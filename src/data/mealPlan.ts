/**
 * Food's plan side: a weekly menu ("Sunday breakfast: oat bowl"), recipes
 * and a rough cost on each food. The plan is what you mean to eat; the log
 * is what you ate. "Ate it" copies a planned food into the log.
 *
 * Tables from supabase/migrations/20261117120000_food_gym_plans.sql.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase-helpers";

import { MEALS, type Food, type FoodInput, type Meal } from "./food";
import { parseWeekdays } from "./gymRoutines";
import { isMissingTable } from "./relationshipsApi";

export type MealPlanItem = {
  id: string;
  user_id: string;
  /** 0 = Sunday. */
  weekday: number;
  meal: string;
  food_id: string;
  servings: number;
  position: number;
  created_at: string;
};

export type MealPlanInput = Pick<MealPlanItem, "weekday" | "meal" | "food_id" | "servings"> & {
  position?: number;
};

/* ------------------------------------------------------------ the week */

export const MEAL_ORDER: string[] = MEALS.map((meal) => meal.value);

/** A day's planned items, in meal order, then as added. */
export function planFor(items: MealPlanItem[], weekday: number): MealPlanItem[] {
  const rank = (meal: string) => {
    const at = MEAL_ORDER.indexOf(meal);
    return at < 0 ? MEAL_ORDER.length : at;
  };
  return items
    .filter((item) => item.weekday === weekday)
    .sort(
      (a, b) =>
        rank(a.meal) - rank(b.meal) ||
        a.position - b.position ||
        a.created_at.localeCompare(b.created_at),
    );
}

export type PlanTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Rough cost of the foods that have one. */
  cost: number;
  /** How many planned items have no cost, so the cost is only part of it. */
  withoutCost: number;
};

/** What a set of planned items adds up to, from each food's own numbers. */
export function planTotals(items: MealPlanItem[], foods: Food[]): PlanTotals {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const totals: PlanTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0, withoutCost: 0 };
  for (const item of items) {
    const food = byId.get(item.food_id);
    if (!food) continue;
    const times = Number(item.servings);
    totals.calories += Number(food.calories) * times;
    totals.protein += Number(food.protein_g ?? 0) * times;
    totals.carbs += Number(food.carbs_g ?? 0) * times;
    totals.fat += Number(food.fat_g ?? 0) * times;
    const cost = foodCost(food);
    if (cost == null) totals.withoutCost += 1;
    else totals.cost += cost * times;
  }
  return totals;
}

/** A food's rough cost per serving, if it has one. */
export function foodCost(food: Food): number | null {
  const value = (food as Food & { cost?: number | null }).cost;
  return value == null ? null : Number(value);
}

/** A food's recipe, if it has one. */
export function foodRecipe(food: Food): string | null {
  const value = (food as Food & { recipe?: string | null }).recipe;
  return value?.trim() ? value : null;
}

/* ------------------------------------------------- import from Markdown */

const MEAL_WORDS: Record<string, Meal> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  supper: "dinner",
  snack: "snack",
  snacks: "snack",
  فطار: "breakfast",
  فطور: "breakfast",
  إفطار: "breakfast",
  افطار: "breakfast",
  غداء: "lunch",
  غدا: "lunch",
  عشاء: "dinner",
  عشا: "dinner",
  سناك: "snack",
};

/** "Breakfast" / "غداء" → the meal, or null. */
export function mealFromWord(word: string): Meal | null {
  return MEAL_WORDS[word.trim().toLowerCase()] ?? null;
}

export type ImportedFood = FoodInput & { recipe: string | null; cost: number | null };
export type ImportedPlanLine = { weekdays: number[]; meal: Meal; food: string; servings: number };
export type FoodImport = { foods: ImportedFood[]; plan: ImportedPlanLine[] };

const EVERY_DAY = /\b(every ?day|daily|all week)\b|كل يوم/i;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function number(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(text);
  return match ? Number(match[1]!.replace(",", ".")) : null;
}

/** "Oat bowl x2", "Chicken breast ×1.5", "Rice" → the name and servings. */
export function parsePlanFood(text: string): { food: string; servings: number } | null {
  const clean = text.trim();
  if (!clean) return null;
  const times = /\s*(?:[x×*]\s*(\d+(?:[.,]\d+)?)|\((\d+(?:[.,]\d+)?)\))\s*$/i.exec(clean);
  const food = (times ? clean.slice(0, times.index) : clean).trim();
  if (!food) return null;
  const servings = times ? Number((times[1] ?? times[2])!.replace(",", ".")) : 1;
  return { food: food.slice(0, 120), servings: servings > 0 && servings <= 50 ? servings : 1 };
}

/**
 * Foods and a weekly menu from Markdown:
 *
 *   # Foods
 *   ## Oat bowl
 *   Serving: 1 bowl
 *   Calories: 350 · Protein: 15 · Carbs: 50 · Fat: 8
 *   Cost: 25
 *   Recipe:
 *   1. Warm the milk ...
 *
 *   # Plan
 *   ## Sun, Wed
 *   - Breakfast: Oat bowl
 *   - Lunch: Chicken breast x2, Rice
 *
 * Under "# Plan" (or Menu / Week), a "##" heading names the days ("Every
 * day" works) and each line is "Meal: food, food x2". Anything else is
 * ignored.
 */
export function parseFoodMarkdown(markdown: string): FoodImport {
  const foods: ImportedFood[] = [];
  const plan: ImportedPlanLine[] = [];
  let section: "foods" | "plan" = "foods";
  let food: ImportedFood | null = null;
  let recipe: string[] | null = null;
  let days: number[] = [];

  const finishFood = () => {
    if (food) {
      if (recipe) food.recipe = recipe.join("\n").trim().slice(0, 8000) || null;
      if (food.name) foods.push(food);
    }
    food = null;
    recipe = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const top = /^#\s+(.+)$/.exec(line);
    if (top) {
      finishFood();
      section = /plan|menu|week|خطة|منيو|أسبوع/i.test(top[1]!) ? "plan" : "foods";
      continue;
    }
    const sub = /^#{2,3}\s+(.+)$/.exec(line);
    if (sub) {
      finishFood();
      if (section === "plan") {
        days = EVERY_DAY.test(sub[1]!) ? ALL_DAYS : parseWeekdays(sub[1]!);
      } else {
        food = {
          name: sub[1]!.trim().slice(0, 120),
          serving_label: null,
          serving_grams: null,
          calories: 0,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          icon: null,
          recipe: null,
          cost: null,
        };
      }
      continue;
    }

    if (section === "plan") {
      const entry = /^\s*(?:[-*+]|\d+[.)])?\s*([^:]+):\s*(.+)$/.exec(line);
      if (!entry || !days.length) continue;
      const meal = mealFromWord(entry[1]!);
      if (!meal) continue;
      for (const part of entry[2]!.split(/[,،+]/)) {
        const item = parsePlanFood(part);
        if (item) plan.push({ weekdays: days, meal, ...item });
      }
      continue;
    }

    if (!food) continue;
    const current: ImportedFood = food;
    if (recipe) {
      recipe.push(line);
      continue;
    }
    if (/^\s*recipe\s*:/i.test(line) || /^\s*(الطريقة|الوصفة)\s*:/.test(line)) {
      recipe = [];
      const rest = line.split(":").slice(1).join(":").trim();
      if (rest) recipe.push(rest);
      continue;
    }
    // "Calories: 350 · Protein: 15 | Fat 8": every "key: value" on the line.
    for (const pair of line.split(/[·|;]/)) {
      const match = /^\s*([^:\d]+?)\s*(?::\s*|\s+)(.+)$/.exec(pair.trim());
      if (!match) continue;
      const key = match[1]!.toLowerCase().trim();
      const value = match[2]!.trim();
      if (/^serving/.test(key) || key === "حصة") current.serving_label = value.slice(0, 60);
      else if (/^grams?$/.test(key)) current.serving_grams = number(value);
      else if (/^(calories|kcal|cal|سعرات)/.test(key)) current.calories = number(value) ?? 0;
      else if (/^protein|^بروتين/.test(key)) current.protein_g = number(value);
      else if (/^carb|^كارب/.test(key)) current.carbs_g = number(value);
      else if (/^fat|^دهون/.test(key)) current.fat_g = number(value);
      else if (/^(cost|price|تكلفة|سعر)/.test(key)) current.cost = number(value);
    }
  }
  finishFood();
  return { foods, plan };
}

/** Plan lines as rows, matched to foods by name; names with no food come back apart. */
export function planRowsFrom(
  plan: ImportedPlanLine[],
  foods: Pick<Food, "id" | "name">[],
): { rows: MealPlanInput[]; missing: string[] } {
  const byName = new Map(foods.map((food) => [food.name.trim().toLowerCase(), food.id]));
  const rows: MealPlanInput[] = [];
  const missing = new Set<string>();
  plan.forEach((line, index) => {
    const id = byName.get(line.food.trim().toLowerCase());
    if (!id) {
      missing.add(line.food);
      return;
    }
    for (const weekday of line.weekdays)
      rows.push({
        weekday,
        meal: line.meal,
        food_id: id,
        servings: line.servings,
        position: index,
      });
  });
  return { rows, missing: [...missing] };
}

/* ---------------------------------------------------------------- rows */

// The generated types don't have this table until the migration is applied.
const table = () => supabase.from("meal_plan_items" as never);

export const mealPlanKey = ["meal_plan_items"] as const;

export const mealPlanQuery = () =>
  queryOptions({
    queryKey: mealPlanKey,
    queryFn: async () =>
      unwrap(
        await table().select("*").order("weekday").order("position").order("created_at"),
      ) as unknown as MealPlanItem[],
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });

export async function addPlanItems(rows: MealPlanInput[]): Promise<void> {
  if (!rows.length) return;
  unwrap(
    await table()
      .insert(rows as never)
      .select(),
  );
}

export async function deletePlanItem(id: string): Promise<void> {
  unwrap(await table().delete().eq("id", id).select());
}

/** Remove the whole weekly plan (your foods stay). */
export async function clearPlan(items: MealPlanItem[]): Promise<void> {
  if (!items.length) return;
  unwrap(
    await table()
      .delete()
      .in(
        "id",
        items.map((item) => item.id),
      )
      .select(),
  );
}
