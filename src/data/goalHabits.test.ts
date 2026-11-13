import { describe, expect, it } from "vitest";

import type { Habit, HabitLog } from "./habits";
import { goalHabits, habitGoalsAvailable } from "./links";

const habit = (id: string, extra: Partial<Habit> = {}) =>
  ({ id, name: id, active: true, goal_id: null, ...extra }) as Habit;
const log = (habit_id: string, log_date: string) => ({ habit_id, log_date }) as HabitLog;

const TODAY = "2026-11-13";

describe("habitGoalsAvailable", () => {
  it("is false while habit rows don't carry goal_id (database not updated)", () => {
    const rows = [{ id: "a", name: "a", active: true }] as unknown as Habit[];
    expect(habitGoalsAvailable(rows)).toBe(false);
    expect(habitGoalsAvailable([])).toBe(false);
  });

  it("is true once rows carry goal_id, even when it is null", () => {
    expect(habitGoalsAvailable([habit("a")])).toBe(true);
  });
});

describe("goalHabits", () => {
  it("lists the active habits linked to the goal, with days logged in the last seven", () => {
    const items = goalHabits(
      [
        habit("walk", { goal_id: "g1" }),
        habit("read", { goal_id: "g2" }),
        habit("old", { goal_id: "g1", active: false }),
        habit("loose"),
      ],
      [
        log("walk", "2026-11-13"),
        log("walk", "2026-11-13"), // twice on one day counts once
        log("walk", "2026-11-10"),
        log("walk", "2026-11-07"), // the first of the seven days
        log("walk", "2026-11-06"), // eight days ago: outside
        log("walk", "2026-11-14"), // future: outside
        log("read", "2026-11-12"),
      ],
      "g1",
      TODAY,
    );
    expect(items.map((item) => item.habit.id)).toEqual(["walk"]);
    expect(items[0]!.lastSeven).toEqual({ done: 3, total: 7 });
  });

  it("is empty for a goal without habits", () => {
    expect(goalHabits([habit("walk")], [], "g1", TODAY)).toEqual([]);
  });
});
