import { describe, expect, it } from "vitest";

import type { FinanceCategory, PaydayConfig, Transaction } from "./finance";
import type { HealthLog, Medication, MedicationLog } from "./health";
import type { Resource, ResourceReading } from "./resources";
import type { PrayerLog } from "./spirit";
import {
  dosesOn,
  hasEnoughPoints,
  healthSeries,
  meterCostPerDay,
  paydayCycle,
  prayersOn,
  quotaRing,
  recentWeeks,
  tasksCompletedPerWeek,
  weeklySpendByCategory,
} from "./stats";
import type { Task } from "./tasks";

const cast = <T>(value: unknown) => value as T;
/* Noon local time so no timezone can move a date across midnight. */
const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe("prayersOn", () => {
  const log = (name: string, date: string, completed: boolean) =>
    cast<PrayerLog>({ prayer_name: name, prayer_date: date, completed });

  it("counts completed prayers on the date out of five", () => {
    const logs = [
      log("fajr", "2026-09-21", true),
      log("dhuhr", "2026-09-21", true),
      log("asr", "2026-09-21", false),
      log("isha", "2026-09-20", true),
    ];
    expect(prayersOn(logs, "2026-09-21")).toEqual({ done: 2, total: 5 });
  });

  it("is zero of five with no logs", () => {
    expect(prayersOn([], "2026-09-21")).toEqual({ done: 0, total: 5 });
  });
});

describe("dosesOn", () => {
  const med = (id: string, times: string[] | null, active = true) =>
    cast<Medication>({ id, schedule_times: times, active });
  const dose = (id: string, slot: string, date: string, taken: boolean) =>
    cast<MedicationLog>({ medication_id: id, time_slot: slot, log_date: date, taken });

  it("counts taken doses against the scheduled slots", () => {
    const meds = [med("a", ["08:00", "20:00"]), med("b", ["09:00"])];
    const logs = [
      dose("a", "08:00", "2026-09-21", true),
      dose("a", "20:00", "2026-09-21", false),
      dose("b", "09:00", "2026-09-21", true),
      dose("b", "09:00", "2026-09-20", true),
    ];
    expect(dosesOn(meds, logs, "2026-09-21")).toEqual({ done: 2, total: 3 });
  });

  it("ignores inactive medications and slots that are no longer scheduled", () => {
    const meds = [med("a", ["08:00"]), med("old", ["07:00"], false)];
    const logs = [
      dose("a", "08:00", "2026-09-21", true),
      dose("a", "13:00", "2026-09-21", true),
      dose("old", "07:00", "2026-09-21", true),
    ];
    expect(dosesOn(meds, logs, "2026-09-21")).toEqual({ done: 1, total: 1 });
  });

  it("has no denominator when nothing is scheduled", () => {
    expect(dosesOn([med("a", null), med("b", [])], [], "2026-09-21")).toBeNull();
  });
});

describe("quotaRing", () => {
  const quota = (extra: Partial<Resource> = {}) =>
    cast<Resource>({ id: "r1", kind: "quota", unit: "GB", quota_amount: 200, ...extra });
  const reading = (value: number, at: string) =>
    cast<ResourceReading>({ resource_id: "r1", reading: value, reading_at: at });

  it("uses the newest reading against the stored quota", () => {
    const ring = quotaRing(quota(), [
      reading(150, "2026-09-10T10:00:00Z"),
      reading(120, "2026-09-15T10:00:00Z"),
    ]);
    expect(ring).toMatchObject({ remaining: 120, quota: 200, unit: "GB" });
  });

  it("returns null without a quota amount, a reading, or for meters", () => {
    expect(
      quotaRing(quota({ quota_amount: null }), [reading(10, "2026-09-10T10:00:00Z")]),
    ).toBeNull();
    expect(quotaRing(quota(), [])).toBeNull();
    expect(quotaRing(quota({ kind: "meter" }), [reading(10, "2026-09-10T10:00:00Z")])).toBeNull();
  });
});

describe("paydayCycle", () => {
  const monthly = (day: number) =>
    cast<PaydayConfig>({
      schedule: "monthly",
      pay_day: day,
      anchor_date: null,
      interval_weeks: null,
    });

  it("measures days since the last payday against the days to the next one", () => {
    expect(paydayCycle(monthly(25), at("2026-09-30"))).toEqual({
      start: "2026-09-25",
      end: "2026-10-25",
      elapsed: 5,
      total: 30,
    });
  });

  it("starts a new cycle on payday itself", () => {
    expect(paydayCycle(monthly(25), at("2026-09-25"))).toMatchObject({ elapsed: 0, total: 30 });
  });

  it("handles a payday that wraps into the previous month", () => {
    expect(paydayCycle(monthly(25), at("2026-10-03"))).toMatchObject({
      start: "2026-09-25",
      end: "2026-10-25",
      elapsed: 8,
    });
  });

  it("supports interval schedules, including payday itself", () => {
    const interval = cast<PaydayConfig>({
      schedule: "interval",
      anchor_date: "2026-09-01",
      interval_weeks: 2,
      pay_day: null,
    });
    expect(paydayCycle(interval, at("2026-09-18"))).toEqual({
      start: "2026-09-15",
      end: "2026-09-29",
      elapsed: 3,
      total: 14,
    });
    expect(paydayCycle(interval, at("2026-09-15"))).toMatchObject({ elapsed: 0, total: 14 });
  });

  it("is null until payday is set up", () => {
    expect(paydayCycle(null, at("2026-09-21"))).toBeNull();
    expect(
      paydayCycle(cast<PaydayConfig>({ schedule: "monthly", pay_day: null }), at("2026-09-21")),
    ).toBeNull();
  });

  it("is null before an interval schedule has started", () => {
    const future = cast<PaydayConfig>({
      schedule: "interval",
      anchor_date: "2027-01-01",
      interval_weeks: 2,
    });
    expect(paydayCycle(future, at("2026-09-21"))).toBeNull();
  });
});

describe("meterCostPerDay", () => {
  const meter = cast<Resource>({ id: "m", kind: "meter", unit_cost: 2 });
  const reading = (value: number, day: string) =>
    cast<ResourceReading>({ resource_id: "m", reading: value, reading_at: `${day}T12:00:00` });

  it("prices the units used between consecutive readings, per day", () => {
    const points = meterCostPerDay(meter, [
      reading(100, "2026-09-01"),
      reading(130, "2026-09-04"),
      reading(140, "2026-09-05"),
    ]);
    expect(points).toEqual([
      { date: "2026-09-04", value: 20 },
      { date: "2026-09-05", value: 20 },
    ]);
  });

  it("skips same-day pairs and resets instead of guessing", () => {
    const points = meterCostPerDay(meter, [
      reading(100, "2026-09-01"),
      reading(110, "2026-09-01"),
      reading(5, "2026-09-03"),
      reading(15, "2026-09-04"),
    ]);
    expect(points).toEqual([{ date: "2026-09-04", value: 20 }]);
  });

  it("returns nothing without a unit cost or for quotas", () => {
    expect(
      meterCostPerDay(cast<Resource>({ id: "m", kind: "meter", unit_cost: null }), []),
    ).toEqual([]);
    expect(meterCostPerDay(cast<Resource>({ id: "m", kind: "quota", unit_cost: 2 }), [])).toEqual(
      [],
    );
  });
});

describe("healthSeries", () => {
  const log = (date: string, hours: number | null, score: number | null) =>
    cast<HealthLog>({ log_date: date, sleep_hours: hours, sleep_score: score });

  it("keeps logged days inside the window, oldest first, skipping empty values", () => {
    const logs = [
      log("2026-09-20", 7.5, 80),
      log("2026-09-10", 6, null),
      log("2026-08-01", 8, 90),
      log("2026-09-18", null, 70),
    ];
    expect(healthSeries(logs, "sleep_hours", 14, at("2026-09-21"))).toEqual([
      { date: "2026-09-10", value: 6 },
      { date: "2026-09-20", value: 7.5 },
    ]);
    expect(healthSeries(logs, "sleep_score", 14, at("2026-09-21"))).toEqual([
      { date: "2026-09-18", value: 70 },
      { date: "2026-09-20", value: 80 },
    ]);
  });
});

describe("weeks", () => {
  it("builds Monday-based weeks ending with the current one", () => {
    const weeks = recentWeeks(3, at("2026-09-23"));
    expect(weeks.map((week) => week.weekStart)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  });

  it("counts completed top-level tasks per week and trims empty leading weeks", () => {
    const done = (id: string, day: string, parent: string | null = null) =>
      cast<Task>({
        id,
        status: "completed",
        parent_task_id: parent,
        completed_at: `${day}T12:00:00`,
      });
    const tasks = [
      done("a", "2026-09-16"),
      done("b", "2026-09-18"),
      done("c", "2026-09-22"),
      done("step", "2026-09-22", "a"),
      cast<Task>({ id: "open", status: "todo", parent_task_id: null, completed_at: null }),
    ];
    expect(
      tasksCompletedPerWeek(tasks, 6, at("2026-09-23")).map((w) => [w.weekStart, w.total]),
    ).toEqual([
      ["2026-09-14", 2],
      ["2026-09-21", 1],
    ]);
  });

  it("is empty when nothing was completed in the window", () => {
    expect(tasksCompletedPerWeek([], 8, at("2026-09-23"))).toEqual([]);
  });
});

describe("weeklySpendByCategory", () => {
  const categories = [
    cast<FinanceCategory>({ id: "food", name: "Food" }),
    cast<FinanceCategory>({ id: "fuel", name: "Fuel" }),
  ];
  const spend = (amount: number, date: string, category: string | null, kind = "expense") =>
    cast<Transaction>({ amount, date, category_id: category, kind });

  it("sums expenses per week and category, ignoring income and adjustments", () => {
    const result = weeklySpendByCategory(
      [
        spend(-50, "2026-09-15", "food"),
        spend(-25, "2026-09-16", "food"),
        spend(-10, "2026-09-22", "fuel"),
        spend(-5, "2026-09-22", null),
        spend(500, "2026-09-22", null, "income"),
        spend(-99, "2026-09-22", "food", "adjustment"),
      ],
      categories,
      4,
      5,
      at("2026-09-23"),
    );
    expect(result.rows.map((row) => [row.weekStart, row.total])).toEqual([
      ["2026-09-14", 75],
      ["2026-09-21", 15],
    ]);
    expect(Object.fromEntries(result.series.map((s) => [s.label, s.total]))).toEqual({
      Food: 75,
      Fuel: 10,
      Uncategorised: 5,
    });
    expect(result.rows[0]).toMatchObject({ food: 75, fuel: 0, uncategorised: 0 });
  });

  it("groups categories beyond the top few as Other", () => {
    const many = ["a", "b", "c"].map((id) => cast<FinanceCategory>({ id, name: id.toUpperCase() }));
    const result = weeklySpendByCategory(
      [spend(-30, "2026-09-22", "a"), spend(-20, "2026-09-22", "b"), spend(-10, "2026-09-22", "c")],
      many,
      2,
      2,
      at("2026-09-23"),
    );
    expect(result.series.map((s) => s.label)).toEqual(["A", "B", "Other"]);
    expect(result.rows[0]).toMatchObject({ a: 30, b: 20, other: 10, total: 60 });
  });

  it("is empty with no expenses in the window", () => {
    expect(weeklySpendByCategory([], categories, 8, 5, at("2026-09-23")).rows).toEqual([]);
  });
});

describe("hasEnoughPoints", () => {
  it("needs two points before a chart is drawn", () => {
    expect(hasEnoughPoints([])).toBe(false);
    expect(hasEnoughPoints([1])).toBe(false);
    expect(hasEnoughPoints([1, 2])).toBe(true);
  });
});
