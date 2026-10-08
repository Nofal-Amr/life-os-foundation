/**
 * History and insights from what was logged — counts, never scores:
 * - month by month per area;
 * - which daily figures went together (with how many days it's based on,
 *   and never a claim that one causes the other);
 * - habit patterns by weekday ("Mondays: 5 of the last 7").
 * Anything with too few days says so instead of guessing.
 */
import { addMonths, format, parseISO, startOfMonth } from "date-fns";

import type { Transaction } from "./finance";
import type { Habit, HabitLog } from "./habits";
import { dailyValues, lastDays, type HealthSample } from "./healthSamples";
import type { PrayerLog } from "./spirit";
import { statusOf } from "./spirit";
import type { Task } from "./tasks";

export type Sources = {
  tasks: Task[];
  prayerLogs: PrayerLog[];
  transactions: Transaction[];
  habitLogs: HabitLog[];
  habits: Habit[];
  healthSamples: HealthSample[];
};

/* ------------------------------------------------------------ by month */

export type MonthRow = {
  month: string; // yyyy-MM
  tasksDone: number;
  prayed: number;
  spent: number;
  habitCheckIns: number;
};

export function byMonth(sources: Sources, today: string, months = 6): MonthRow[] {
  const first = startOfMonth(addMonths(parseISO(today), -(months - 1)));
  const keys = Array.from({ length: months }, (_, i) => format(addMonths(first, i), "yyyy-MM"));
  const rows = new Map(
    keys.map((month) => [month, { month, tasksDone: 0, prayed: 0, spent: 0, habitCheckIns: 0 }]),
  );
  for (const task of sources.tasks) {
    if (task.status !== "completed" || !task.completed_at) continue;
    const row = rows.get(task.completed_at.slice(0, 7));
    if (row) row.tasksDone += 1;
  }
  for (const log of sources.prayerLogs) {
    const status = statusOf(log);
    if (!status || status === "missed") continue;
    const row = rows.get(log.prayer_date.slice(0, 7));
    if (row) row.prayed += 1;
  }
  for (const t of sources.transactions) {
    if (t.kind !== "expense") continue;
    const row = rows.get(t.date.slice(0, 7));
    if (row) row.spent += Math.abs(Number(t.amount));
  }
  for (const log of sources.habitLogs) {
    const row = rows.get(log.log_date.slice(0, 7));
    if (row) row.habitCheckIns += 1;
  }
  return keys.map((key) => rows.get(key)!);
}

/* ---------------------------------------------------- went together */

export type Series = { key: string; label: string; values: (number | null)[] };

/** Daily figures for the last `days` days; null where nothing was logged. */
export function dailySeries(
  sources: Sources,
  today: string,
  days = 90,
): { dates: string[]; series: Series[] } {
  const dates = lastDays(days, today);
  const index = new Map(dates.map((date, i) => [date, i]));
  const blank = () => dates.map(() => null as number | null);

  const tasks = blank();
  for (const task of sources.tasks) {
    if (task.status !== "completed" || !task.completed_at) continue;
    const i = index.get(task.completed_at.slice(0, 10));
    if (i != null) tasks[i] = (tasks[i] ?? 0) + 1;
  }
  const prayed = blank();
  const prayerLogged = new Set<number>();
  for (const log of sources.prayerLogs) {
    const i = index.get(log.prayer_date);
    if (i == null) continue;
    prayerLogged.add(i);
    const status = statusOf(log);
    prayed[i] = (prayed[i] ?? 0) + (status && status !== "missed" ? 1 : 0);
  }
  const spent = blank();
  for (const t of sources.transactions) {
    if (t.kind !== "expense") continue;
    const i = index.get(t.date);
    if (i != null) spent[i] = (spent[i] ?? 0) + Math.abs(Number(t.amount));
  }
  const habits = blank();
  for (const log of sources.habitLogs) {
    const i = index.get(log.log_date);
    if (i != null) habits[i] = (habits[i] ?? 0) + 1;
  }
  const sleep = dailyValues(sources.healthSamples, "sleep", dates).map((v) => (v ? v / 60 : null));
  const steps = dailyValues(sources.healthSamples, "steps", dates).map((v) => (v ? v : null));

  // A day with nothing logged anywhere for tasks still counts as 0 tasks only
  // if the app was used that day (any other log); otherwise it's unknown.
  const used = dates.map(
    (_, i) =>
      [prayed[i], spent[i], habits[i], sleep[i], steps[i]].some((v) => v != null) ||
      tasks[i] != null,
  );
  const zeroIfUsed = (values: (number | null)[]) =>
    values.map((v, i) => (v == null && used[i] ? 0 : v));

  return {
    dates,
    series: [
      { key: "sleep", label: "hours of sleep", values: sleep },
      { key: "steps", label: "steps", values: steps },
      { key: "tasks", label: "tasks done", values: zeroIfUsed(tasks) },
      {
        key: "prayed",
        label: "prayers prayed",
        values: prayed.map((v, i) => (prayerLogged.has(i) ? v : null)),
      },
      { key: "spent", label: "spent", values: zeroIfUsed(spent) },
      { key: "habits", label: "habit check-ins", values: zeroIfUsed(habits) },
    ],
  };
}

/** Pearson correlation over days both have a value; null below `minDays`. */
export function correlation(
  a: (number | null)[],
  b: (number | null)[],
  minDays = 14,
): { r: number; days: number } | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x != null && y != null) pairs.push([x, y]);
  }
  if (pairs.length < minDays) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), days: n };
}

export type Pairing = {
  a: Series;
  b: Series;
  r: number;
  days: number;
  strength: "weak" | "moderate" | "strong";
};

/** Pairs that went together at least moderately, strongest first. */
export function pairings(series: Series[], minDays = 14): Pairing[] {
  const out: Pairing[] = [];
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const result = correlation(series[i]!.values, series[j]!.values, minDays);
      if (!result || Math.abs(result.r) < 0.3) continue;
      const size = Math.abs(result.r);
      out.push({
        a: series[i]!,
        b: series[j]!,
        r: Math.round(result.r * 100) / 100,
        days: result.days,
        strength: size >= 0.6 ? "strong" : size >= 0.45 ? "moderate" : "weak",
      });
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

/* ------------------------------------------------- habits by weekday */

export type WeekdayPattern = { weekday: number; done: number; of: number };

/** For each weekday: how many of the last `weeks` such days the habit was logged. */
export function habitByWeekday(
  habit: Habit,
  logs: HabitLog[],
  today: string,
  weeks = 8,
): WeekdayPattern[] {
  const dates = lastDays(weeks * 7, today);
  const logged = new Set(
    logs.filter((log) => log.habit_id === habit.id).map((log) => log.log_date),
  );
  const createdOn = habit.created_at.slice(0, 10);
  const out: WeekdayPattern[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    done: 0,
    of: 0,
  }));
  for (const date of dates) {
    if (date < createdOn) continue;
    const pattern = out[parseISO(date).getDay()]!;
    pattern.of += 1;
    if (logged.has(date)) pattern.done += 1;
  }
  return out;
}
