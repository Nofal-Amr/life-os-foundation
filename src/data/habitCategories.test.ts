import { describe, expect, it } from "vitest";

import { guessHabitCategory, habitCategory } from "./habitCategories";

describe("guessHabitCategory", () => {
  it.each([
    ["Walk 30 minutes", "health"],
    ["Drink 2 litres of water", "health"],
    ["Water the plants", "home"],
    ["Read 20 pages", "mind"],
    ["Pray Fajr in the mosque", "spirit"],
    ["Call grandma", "people"],
    ["No-spend day", "money"],
    ["Deep work block", "work"],
    ["Something else", "other"],
  ])("%s -> %s", (name, category) => {
    expect(guessHabitCategory(name)).toBe(category);
  });

  it("matches whole words only", () => {
    expect(guessHabitCategory("Rerun the tests")).toBe("other");
  });
});

describe("habitCategory", () => {
  it("prefers the chosen category over the guess", () => {
    expect(habitCategory({ name: "Walk", category: "people" })).toBe("people");
    expect(habitCategory({ name: "Walk", category: null })).toBe("health");
    expect(habitCategory({ name: "Walk", category: "nonsense" })).toBe("health");
  });
});
