import { describe, expect, it } from "vitest";

import type { Transaction } from "./finance";
import type { Habit, HabitLog } from "./habits";
import type { PrayerLog } from "./spirit";
import type { Task } from "./tasks";
import { buildWeek, placeTask, splitPlan, weekRecap, weekStart } from "./week";

const task = (id: string, due: string | null, extra: Partial<Task> = {}) =>
  ({
    id,
    due_date: due,
    status: "todo",
    parent_task_id: null,
    completed_at: null,
    title: id,
    ...extra,
  }) as Task;

const base = {
  start: "2026-09-21",
  today: "2026-09-23",
  tasks: [] as Task[],
  habits: [] as Habit[],
  habitLogs: [] as HabitLog[],
  prayerLogs: [] as PrayerLog[],
  transactions: [] as Transaction[],
  trackPrayers: true,
};

describe("week start", () => {
  it("starts the week on the chosen day", () => {
    expect(weekStart("2026-09-23", 1)).toBe("2026-09-21");
    expect(weekStart("2026-09-23", 6)).toBe("2026-09-19");
    expect(weekStart("2026-09-23", 0)).toBe("2026-09-20");
  });
});

describe("where tasks sit in the week", () => {
  it("puts a done task on the day it was done, not the day it was due", () => {
    const early = task("early", "2026-09-24", {
      status: "completed",
      completed_at: "2026-09-22T10:00:00",
    });
    expect(placeTask(early, "2026-09-23")).toBe("2026-09-22");
  });

  it("moves overdue open tasks to today and ignores cancelled ones", () => {
    expect(placeTask(task("late", "2026-09-21"), "2026-09-23")).toBe("2026-09-23");
    expect(placeTask(task("gone", "2026-09-24", { status: "cancelled" }), "2026-09-23")).toBeNull();
  });

  it("offers tasks due later in the week from today, counting them only on their day", () => {
    const week = buildWeek({
      ...base,
      tasks: [task("wed", "2026-09-23"), task("fri", "2026-09-25")],
    });
    const wed = week.days[2]!;
    expect(wed.tasksDone).toEqual({ done: 0, total: 1 });
    expect(wed.dueLater.map((t) => t.id)).toEqual(["fri"]);
    // Past days don't offer early work.
    expect(week.days[0]!.dueLater).toEqual([]);
    expect(week.tasks).toEqual({ done: 0, total: 2 });
  });

  it("shows dated parts instead of the task they split", () => {
    const week = buildWeek({
      ...base,
      tasks: [
        task("big", "2026-09-25"),
        task("part1", "2026-09-23", { parent_task_id: "big" }),
        task("part2", "2026-09-25", { parent_task_id: "big" }),
        task("undated-step", null, { parent_task_id: "other" }),
      ],
    });
    const ids = week.days.flatMap((day) => day.tasks.map((t) => t.id));
    expect(ids).toEqual(["part1", "part2"]);
  });
});

describe("habits, prayers and money", () => {
  it("only counts habit and prayer days that have started", () => {
    const week = buildWeek({
      ...base,
      habits: [{ id: "h", active: true, frequency: "daily" } as Habit],
      habitLogs: [{ habit_id: "h", log_date: "2026-09-22" } as HabitLog],
      prayerLogs: [
        {
          prayer_date: "2026-09-21",
          prayer_name: "fajr",
          completed: true,
          status: "late",
        } as PrayerLog,
        {
          prayer_date: "2026-09-21",
          prayer_name: "dhuhr",
          completed: false,
          status: "missed",
        } as PrayerLog,
      ],
    });
    expect(week.habits).toEqual({ done: 1, total: 3 });
    expect(week.prayers).toEqual({ done: 1, total: 15 });
  });

  it("totals spending per day from expenses only", () => {
    const week = buildWeek({
      ...base,
      transactions: [
        { date: "2026-09-22", kind: "expense", amount: -120 } as Transaction,
        { date: "2026-09-22", kind: "income", amount: 5000 } as Transaction,
        { date: "2026-09-24", kind: "expense", amount: -30 } as Transaction,
      ],
    });
    expect(week.days.map((day) => day.spent)).toEqual([0, 120, 0, 30, 0, 0, 0]);
    expect(weekRecap(week, (v) => `EGP ${v}`)).toContain("EGP 150 spent across 2 days.");
  });

  it("says nothing when nothing was logged", () => {
    expect(weekRecap(buildWeek({ ...base, trackPrayers: false }), String)).toEqual([]);
  });
});

describe("splitting a big task", () => {
  it("spreads parts from today to the due date and shares the estimate", () => {
    expect(
      splitPlan({ from: "2026-09-21", due: "2026-09-23", parts: 3, estimatedMinutes: 180 }),
    ).toEqual([
      { date: "2026-09-21", minutes: 60 },
      { date: "2026-09-22", minutes: 60 },
      { date: "2026-09-23", minutes: 60 },
    ]);
  });

  it("never makes more parts than days, and keeps leftover minutes", () => {
    const plan = splitPlan({
      from: "2026-09-22",
      due: "2026-09-23",
      parts: 5,
      estimatedMinutes: 125,
    });
    expect(plan).toEqual([
      { date: "2026-09-22", minutes: 63 },
      { date: "2026-09-23", minutes: 62 },
    ]);
  });
});
