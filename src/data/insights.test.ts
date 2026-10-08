import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { byMonth, correlation, habitByWeekday, pairings, type Series } from "./insights";
import type { Habit, HabitLog } from "./habits";
import type { Task } from "./tasks";

describe("byMonth", () => {
  it("counts each month from real rows", () => {
    const rows = byMonth(
      {
        tasks: [
          { status: "completed", completed_at: "2026-10-02T10:00:00Z" },
          { status: "completed", completed_at: "2026-09-12T10:00:00Z" },
          { status: "todo", completed_at: null },
        ] as Task[],
        prayerLogs: [],
        transactions: [{ kind: "expense", amount: -50, date: "2026-10-03" }] as never,
        habitLogs: [],
        habits: [],
        healthSamples: [],
      },
      "2026-10-08",
      2,
    );
    expect(rows).toEqual([
      { month: "2026-09", tasksDone: 1, prayed: 0, spent: 0, habitCheckIns: 0 },
      { month: "2026-10", tasksDone: 1, prayed: 0, spent: 50, habitCheckIns: 0 },
    ]);
  });
});

describe("correlation", () => {
  it("needs enough shared days, and ignores days missing in either", () => {
    const a = Array.from({ length: 20 }, (_, i) => i);
    const b = Array.from({ length: 20 }, (_, i) => i * 2 + 1);
    expect(correlation(a, b)).toEqual({ r: 1, days: 20 });
    expect(correlation(a.slice(0, 10), b.slice(0, 10))).toBeNull();
    const gappy = b.map((v, i) => (i % 2 ? null : v));
    expect(correlation(a, gappy)?.days ?? 0).toBe(0);
  });

  it("lists only pairs that went together, strongest first", () => {
    const up: Series = { key: "x", label: "x", values: Array.from({ length: 20 }, (_, i) => i) };
    const alsoUp: Series = {
      key: "y",
      label: "y",
      values: Array.from({ length: 20 }, (_, i) => i + (i % 3)),
    };
    const flat: Series = {
      key: "z",
      label: "z",
      values: Array.from({ length: 20 }, (_, i) => (i % 2 ? 5 : 6)),
    };
    const result = pairings([up, alsoUp, flat]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ days: 20, strength: "strong" });
  });
});

describe("habitByWeekday", () => {
  it("counts logged days per weekday since the habit began", () => {
    const habit = { id: "h", created_at: "2026-09-01T00:00:00Z" } as Habit;
    const logs = [
      { habit_id: "h", log_date: "2026-10-05" }, // Monday
      { habit_id: "h", log_date: "2026-09-28" }, // Monday
    ] as HabitLog[];
    const monday = habitByWeekday(habit, logs, "2026-10-08", 2)[1]!;
    expect(monday).toEqual({ weekday: 1, done: 2, of: 2 });
  });
});
