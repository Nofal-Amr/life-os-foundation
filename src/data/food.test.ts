import { describe, expect, it } from "vitest";

import { mealForTime, recentOneOffs, suggestedFoods, type Food, type FoodLog } from "./food";

describe("quick meals", () => {
  it("picks the meal from the time of day", () => {
    const at = (h: number) => new Date(2026, 8, 21, h, 0);
    expect([7, 13, 19, 23, 16].map((h) => mealForTime(at(h)))).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
      "snack",
    ]);
  });

  it("offers typed foods again, newest first, once each", () => {
    const log = (name: string, created: string, food_id: string | null = null) =>
      ({ name, created_at: created, food_id }) as FoodLog;
    const logs = [
      log("Koshari", "2026-09-20T13:00:00Z"),
      log("koshari", "2026-09-21T13:00:00Z"),
      log("Oats", "2026-09-21T08:00:00Z"),
      log("Library food", "2026-09-21T09:00:00Z", "f1"),
    ];
    expect(recentOneOffs(logs).map((l) => l.name)).toEqual(["koshari", "Oats"]);
  });
});

describe("suggestedFoods by meal", () => {
  const food = (id: string, name: string) =>
    ({ id, name, calories: 100 }) as unknown as Food;
  const log = (food_id: string, meal: string) =>
    ({ food_id, meal }) as unknown as FoodLog;

  it("puts what you usually have at this meal first", () => {
    const foods = [food("ful", "Ful"), food("rice", "Rice")];
    const logs = [log("rice", "lunch"), log("rice", "lunch"), log("ful", "breakfast")];
    expect(suggestedFoods(foods, logs, 2, "breakfast").map((f) => f.id)).toEqual(["ful", "rice"]);
    expect(suggestedFoods(foods, logs, 2, "lunch").map((f) => f.id)).toEqual(["rice", "ful"]);
  });
});
