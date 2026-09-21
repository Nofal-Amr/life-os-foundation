/**
 * Derived facts for the "at a glance" cards. Everything here is computed from
 * rows the user already stored — no targets, scores or verdicts. Every ring has
 * a real stored denominator; every series returns only points backed by rows.
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

import type { FinanceCategory, PaydayConfig, Transaction } from "@/data/finance";
import { hasPaydaySetup, nextPayday, previousPayday } from "@/data/finance";
import type { HealthLog, Medication, MedicationLog } from "@/data/health";
import type { Resource, ResourceReading } from "@/data/resources";
import { readingsFor } from "@/data/resources";
import type { PrayerLog } from "@/data/spirit";
import { PRAYER_NAMES } from "@/data/spirit";
import type { Task } from "@/data/tasks";

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

/** A chart needs at least two real points; anything less shows a plain empty state. */
export const MIN_POINTS = 2;
export function hasEnoughPoints(points: readonly unknown[]): boolean {
  return points.length >= MIN_POINTS;
}

/* --------------------------------- rings --------------------------------- */

export type Fraction = { done: number; total: number };

/** Prayers logged as completed on a date, out of the five daily prayers. */
export function prayersOn(logs: PrayerLog[], date: string): Fraction {
  const names = new Set<string>(PRAYER_NAMES);
  const done = new Set(
    logs
      .filter((log) => log.prayer_date === date && log.completed && names.has(log.prayer_name))
      .map((log) => log.prayer_name),
  ).size;
  return { done, total: PRAYER_NAMES.length };
}

/**
 * Doses marked taken on a date, out of the doses scheduled for that day by
 * active medications. A logged slot that is no longer scheduled is not counted.
 * Returns null when nothing is scheduled, because there is no denominator.
 */
export function dosesOn(
  medications: Medication[],
  logs: MedicationLog[],
  date: string,
): Fraction | null {
  const scheduled = medications
    .filter((medication) => medication.active)
    .flatMap((medication) =>
      [...new Set(medication.schedule_times ?? [])].map((slot) => `${medication.id}|${slot}`),
    );
  if (scheduled.length === 0) return null;
  const taken = new Set(
    logs
      .filter((log) => log.log_date === date && log.taken)
      .map((log) => `${log.medication_id}|${log.time_slot}`),
  );
  return { done: scheduled.filter((key) => taken.has(key)).length, total: scheduled.length };
}

export type QuotaRing = {
  resource: Resource;
  remaining: number;
  quota: number;
  unit: string;
  readingAt: string;
};

/** What is left, from the newest reading, against the stored quota amount. */
export function quotaRing(resource: Resource, readings: ResourceReading[]): QuotaRing | null {
  if (resource.kind !== "quota") return null;
  const quota = resource.quota_amount == null ? 0 : Number(resource.quota_amount);
  if (!(quota > 0)) return null;
  const own = readingsFor(resource, readings);
  const latest = own[own.length - 1];
  if (!latest) return null;
  return {
    resource,
    remaining: Number(latest.reading),
    quota,
    unit: resource.unit,
    readingAt: latest.reading_at,
  };
}

export type PaydayCycle = { start: string; end: string; elapsed: number; total: number };

/**
 * Days since the last payday out of the days between it and the next one.
 * Null until payday is set up, or when today does not sit inside a known cycle.
 */
export function paydayCycle(
  config: PaydayConfig | null | undefined,
  today: Date = new Date(),
): PaydayCycle | null {
  if (!config || !hasPaydaySetup(config)) return null;
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  /* Strictly after today, so a payday that is today opens a new cycle. */
  const end = nextPayday(config, addDays(day, 1));
  if (!end) return null;

  let start: Date | null;
  if (config.schedule === "monthly") {
    start = previousPayday(config, day);
  } else {
    const weeks = Number(config.interval_weeks ?? 0);
    start = weeks > 0 ? addDays(end, -weeks * 7) : null;
  }
  if (!start || start > day) return null;

  const total = differenceInCalendarDays(end, start);
  if (total <= 0) return null;
  return {
    start: dayKey(start),
    end: dayKey(end),
    elapsed: differenceInCalendarDays(day, start),
    total,
  };
}

/* --------------------------------- trends -------------------------------- */

export type SeriesPoint = { date: string; value: number };

/**
 * Cost per day between each pair of consecutive readings of a meter, using the
 * resource's own unit cost. Pairs on the same calendar day, and pairs where the
 * reading went down (a reset), are skipped rather than guessed at.
 */
export function meterCostPerDay(resource: Resource, readings: ResourceReading[]): SeriesPoint[] {
  if (resource.kind !== "meter" || resource.unit_cost == null) return [];
  const unitCost = Number(resource.unit_cost);
  const own = readingsFor(resource, readings);
  const points: SeriesPoint[] = [];
  for (let index = 1; index < own.length; index += 1) {
    const previous = own[index - 1];
    const current = own[index];
    if (!previous || !current) continue;
    const days = differenceInCalendarDays(
      new Date(current.reading_at),
      new Date(previous.reading_at),
    );
    const used = Number(current.reading) - Number(previous.reading);
    if (days <= 0 || used < 0) continue;
    points.push({
      date: dayKey(new Date(current.reading_at)),
      value: (used * unitCost) / days,
    });
  }
  return points;
}

/** A logged health number for each day it was logged within the last `days` days. */
export function healthSeries(
  logs: HealthLog[],
  field: "sleep_hours" | "sleep_score",
  days: number,
  today: Date = new Date(),
): SeriesPoint[] {
  const from = dayKey(addDays(today, -(days - 1)));
  const to = dayKey(today);
  return logs
    .filter((log) => log.log_date >= from && log.log_date <= to && log[field] != null)
    .map((log) => ({ date: log.log_date, value: Number(log[field]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type WeekBucket = { weekStart: string; label: string };

/** Monday-based weeks ending with the week `today` falls in, oldest first. */
export function recentWeeks(count: number, today: Date = new Date()): WeekBucket[] {
  const current = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(current, -7 * (count - 1 - index));
    return { weekStart: dayKey(start), label: format(start, "d MMM") };
  });
}

function weekOf(date: string): string {
  return dayKey(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
}

/** Drops weeks before the first one with data, so a new user does not see a run of empty weeks. */
function trimLeadingEmpty<T extends { total: number }>(rows: T[]): T[] {
  const first = rows.findIndex((row) => row.total > 0);
  return first === -1 ? [] : rows.slice(first);
}

export type WeeklyCount = { weekStart: string; label: string; total: number };

/** Top-level tasks completed per week, by their real completion time. */
export function tasksCompletedPerWeek(
  tasks: Task[],
  count = 8,
  today: Date = new Date(),
): WeeklyCount[] {
  const weeks = recentWeeks(count, today);
  const totals = new Map<string, number>();
  for (const task of tasks) {
    if (task.parent_task_id != null || task.status !== "completed" || !task.completed_at) continue;
    const week = weekOf(dayKey(new Date(task.completed_at)));
    totals.set(week, (totals.get(week) ?? 0) + 1);
  }
  return trimLeadingEmpty(
    weeks.map((week) => ({ ...week, total: totals.get(week.weekStart) ?? 0 })),
  );
}

export type SpendSeries = { key: string; label: string; total: number };
export type WeeklySpend = {
  series: SpendSeries[];
  /** One row per week: `weekStart`, `label`, `total`, and one number per series key. */
  rows: (WeeklyCount & Record<string, number | string>)[];
};

const OTHER_KEY = "other";
const UNCATEGORISED_KEY = "uncategorised";

/**
 * Expense spending per week, split by category. The largest `topCategories`
 * are kept; the rest are grouped as "Other". Income and adjustments are ignored.
 */
export function weeklySpendByCategory(
  transactions: Transaction[],
  categories: FinanceCategory[],
  count = 8,
  topCategories = 5,
  today: Date = new Date(),
): WeeklySpend {
  const weeks = recentWeeks(count, today);
  const inWindow = new Set(weeks.map((week) => week.weekStart));
  const names = new Map(categories.map((category) => [category.id, category.name]));

  const spend = new Map<string, Map<string, number>>();
  const totalsByKey = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    const week = weekOf(transaction.date);
    if (!inWindow.has(week)) continue;
    const key = transaction.category_id ?? UNCATEGORISED_KEY;
    labels.set(
      key,
      transaction.category_id
        ? (names.get(transaction.category_id) ?? "Removed category")
        : "Uncategorised",
    );
    const amount = Math.abs(Number(transaction.amount));
    const inWeek = spend.get(week) ?? new Map<string, number>();
    inWeek.set(key, (inWeek.get(key) ?? 0) + amount);
    spend.set(week, inWeek);
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + amount);
  }

  const ranked = [...totalsByKey.entries()].sort((a, b) => b[1] - a[1]);
  const kept = ranked.slice(0, topCategories).map(([key]) => key);
  const keptSet = new Set(kept);
  const otherTotal = ranked.filter(([key]) => !keptSet.has(key)).reduce((sum, [, v]) => sum + v, 0);

  const series: SpendSeries[] = kept.map((key) => ({
    key,
    label: labels.get(key) ?? key,
    total: totalsByKey.get(key) ?? 0,
  }));
  if (otherTotal > 0) series.push({ key: OTHER_KEY, label: "Other", total: otherTotal });

  const rows = weeks.map((week) => {
    const inWeek = spend.get(week.weekStart) ?? new Map<string, number>();
    const row: WeeklyCount & Record<string, number | string> = { ...week, total: 0 };
    for (const entry of series) row[entry.key] = 0;
    for (const [key, amount] of inWeek) {
      const target = keptSet.has(key) ? key : OTHER_KEY;
      row[target] = Number(row[target] ?? 0) + amount;
      row.total += amount;
    }
    return row;
  });

  return { series, rows: trimLeadingEmpty(rows) };
}
