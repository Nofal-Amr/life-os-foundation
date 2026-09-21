import { describe, expect, it } from "vitest";

import type { Transaction } from "./finance";
import type { Habit, HabitLog } from "./habits";
import type { PrayerLog } from "./spirit";
import type { Task } from "./tasks";
import { buildWeek, weekRecap, weekStart } from "./week";

const task = (
  id: string,
  due: string,
  status: Task["status"] = "todo",
  parent: string | null = null,
) => ({ id, due_date: due, status, parent_task_id: parent, title: id }) as Task;

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

describe("week view counts", () => {
  it("starts the week on the chosen day", () => {
    expect(weekStart("2026-09-23", 1)).toBe("2026-09-21");
    expect(weekStart("2026-09-23", 6)).toBe("2026-09-19");
  });

  it("counts top-level tasks due each day, ignoring steps and cancelled ones", () => {
    const week = buildWeek({
      ...base,
      tasks: [
        task("a", "2026-09-21", "completed"),
        task("b", "2026-09-21"),
        task("step", "2026-09-21", "completed", "a"),
        task("gone", "2026-09-21", "cancelled"),
        task("c", "2026-09-25"),
      ],
    });
    expect(week.days[0]!.tasksDone).toEqual({ done: 1, total: 2 });
    expect(week.days[4]!.tasksDone).toEqual({ done: 0, total: 1 });
    expect(week.tasks).toEqual({ done: 1, total: 3 });
  });

  it("only counts habit and prayer days that have started", () => {
    const week = buildWeek({
      ...base,
      habits: [{ id: "h", active: true, frequency: "daily" } as Habit],
      habitLogs: [{ habit_id: "h", log_date: "2026-09-22" } as HabitLog],
      prayerLogs: [
        { prayer_date: "2026-09-21", prayer_name: "fajr", completed: true } as PrayerLog,
        { prayer_date: "2026-09-21", prayer_name: "fajr", completed: true } as PrayerLog,
      ],
    });
    // Mon–Wed have started: 3 habit check-ins possible, 15 prayers.
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
    expect(week.spent).toBe(150);
    expect(weekRecap(week, (v) => `EGP ${v}`)).toContain("EGP 150 spent across 2 days.");
  });

  it("says nothing when nothing was logged", () => {
    const week = buildWeek({ ...base, trackPrayers: false });
    expect(weekRecap(week, String)).toEqual([]);
  });
});
