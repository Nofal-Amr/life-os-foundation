import { describe, expect, it } from "vitest";

import { mealForTime, recentOneOffs, type FoodLog } from "./food";

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
