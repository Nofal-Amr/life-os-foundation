import { describe, expect, it } from "vitest";

import { FOOD_LIBRARY, libraryNotYetAdded, toFoodInput } from "./foodLibrary";

describe("food library", () => {
  it("has sane figures for every entry", () => {
    for (const food of FOOD_LIBRARY) {
      expect(food.name.length).toBeGreaterThan(2);
      expect(food.calories).toBeGreaterThanOrEqual(0);
      expect(food.calories).toBeLessThan(1000);
      expect(food.serving_label).not.toBe("");
      // Calories should roughly match the macros (4/4/9 kcal per gram).
      const fromMacros = food.protein_g * 4 + food.carbs_g * 4 + food.fat_g * 9;
      expect(Math.abs(fromMacros - food.calories)).toBeLessThanOrEqual(
        Math.max(35, food.calories * 0.35),
      );
    }
  });

  it("has no duplicate names", () => {
    const names = FOOD_LIBRARY.map((food) => food.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("skips what you already have, ignoring case", () => {
    const rest = libraryNotYetAdded([{ name: "white rice, steamed" }]);
    expect(rest.some((food) => food.name === "White rice, steamed")).toBe(false);
    expect(rest.length).toBe(FOOD_LIBRARY.length - 1);
  });

  it("turns an entry into a food for your library", () => {
    const input = toFoodInput(FOOD_LIBRARY[0]!);
    expect(input.name).toBe(FOOD_LIBRARY[0]!.name);
    expect(input.icon).toBeNull();
  });
});
