import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import type { Food } from "./food";
import {
  parseFoodMarkdown,
  parsePlanFood,
  planFor,
  planRowsFrom,
  planTotals,
  type MealPlanItem,
} from "./mealPlan";

const food = (id: string, name: string, calories: number, cost: number | null) =>
  ({
    id,
    name,
    calories,
    protein_g: 10,
    carbs_g: null,
    fat_g: null,
    cost,
  }) as unknown as Food;

const item = (patch: Partial<MealPlanItem>): MealPlanItem => ({
  id: Math.random().toString(),
  user_id: "u",
  weekday: 0,
  meal: "breakfast",
  food_id: "oats",
  servings: 1,
  position: 0,
  created_at: "2026-11-17T00:00:00Z",
  ...patch,
});

describe("the weekly plan", () => {
  it("lists a day's foods in meal order", () => {
    const items = [
      item({ meal: "dinner", food_id: "rice" }),
      item({ meal: "breakfast", food_id: "oats" }),
      item({ weekday: 1, food_id: "other" }),
      item({ meal: "lunch", food_id: "chicken" }),
    ];
    expect(planFor(items, 0).map((row) => row.food_id)).toEqual(["oats", "chicken", "rice"]);
  });

  it("adds up calories and rough cost, saying how many have no cost", () => {
    const foods = [food("oats", "Oats", 350, 25), food("rice", "Rice", 200, null)];
    const totals = planTotals(
      [item({ food_id: "oats", servings: 2 }), item({ food_id: "rice" })],
      foods,
    );
    expect(totals.calories).toBe(900);
    expect(totals.protein).toBe(30);
    expect(totals.cost).toBe(50);
    expect(totals.withoutCost).toBe(1);
  });
});

describe("importing foods and a plan from Markdown", () => {
  const markdown = `# Foods
## Oat bowl
Serving: 1 bowl
Calories: 350 · Protein: 15 · Carbs: 50 · Fat: 8
Cost: 25
Recipe:
1. Warm the milk.
2. Stir in the oats.

## Grilled chicken
Calories: 165 | Protein: 31
Price: 60 EGP

# Plan
## Sun, Wed
- Breakfast: Oat bowl
- Lunch: Grilled chicken x2, Rice
## Every day
- Snack: Banana (1.5)
`;

  it("reads each food's numbers, cost and recipe", () => {
    const { foods } = parseFoodMarkdown(markdown);
    expect(foods.map((item) => item.name)).toEqual(["Oat bowl", "Grilled chicken"]);
    expect(foods[0]).toMatchObject({
      serving_label: "1 bowl",
      calories: 350,
      protein_g: 15,
      carbs_g: 50,
      fat_g: 8,
      cost: 25,
      recipe: "1. Warm the milk.\n2. Stir in the oats.",
    });
    expect(foods[1]).toMatchObject({ calories: 165, protein_g: 31, cost: 60, recipe: null });
  });

  it("reads the menu: days, meal, foods and servings", () => {
    const { plan } = parseFoodMarkdown(markdown);
    expect(plan).toEqual([
      { weekdays: [0, 3], meal: "breakfast", food: "Oat bowl", servings: 1 },
      { weekdays: [0, 3], meal: "lunch", food: "Grilled chicken", servings: 2 },
      { weekdays: [0, 3], meal: "lunch", food: "Rice", servings: 1 },
      { weekdays: [0, 1, 2, 3, 4, 5, 6], meal: "snack", food: "Banana", servings: 1.5 },
    ]);
  });

  it("understands Arabic meal names", () => {
    const { plan } = parseFoodMarkdown("# Plan\n## Sun\n- فطار: فول\n- غداء: رز x2");
    expect(plan.map((line) => [line.meal, line.food, line.servings])).toEqual([
      ["breakfast", "فول", 1],
      ["lunch", "رز", 2],
    ]);
  });

  it("matches plan lines to foods by name and reports the ones it can't find", () => {
    const { plan } = parseFoodMarkdown(markdown);
    const { rows, missing } = planRowsFrom(plan, [
      { id: "1", name: "oat bowl" },
      { id: "2", name: "Grilled chicken" },
    ]);
    expect(rows.filter((row) => row.food_id === "1").map((row) => row.weekday)).toEqual([0, 3]);
    expect(rows.find((row) => row.food_id === "2")?.servings).toBe(2);
    expect(missing).toEqual(["Rice", "Banana"]);
  });

  it("reads servings from x2, ×1.5 and (2)", () => {
    expect(parsePlanFood("Rice x2")).toEqual({ food: "Rice", servings: 2 });
    expect(parsePlanFood("Rice ×1.5")).toEqual({ food: "Rice", servings: 1.5 });
    expect(parsePlanFood("Rice (2)")).toEqual({ food: "Rice", servings: 2 });
    expect(parsePlanFood("  ")).toBeNull();
  });
});
