/**
 * The life hub: one line per life dimension, from real rows only.
 *
 * Serious skin: counts for the last 7 days ("12 of 35 prayers").
 * RPG skin (opt-in): the same rows as XP, levels, a 0–100 stat per dimension
 * (the 7-day ratio × 100) and streaks. Every figure carries a plain
 * explanation of exactly how it is worked out.
 *
 * Dimensions follow Maslow loosely: body (physiological), money (safety),
 * work (esteem), spirit and habits (self-actualisation).
 */
import { addDays, format, parseISO } from "date-fns";

import type { Transaction } from "./finance";
import type { HabitLog, Habit } from "./habits";
import type { Medication, MedicationLog } from "./health";
import { dailyValues, lastDays, type HealthSample } from "./healthSamples";
import type { PrayerLog } from "./spirit";
import { statusOf } from "./spirit";
import type { Task } from "./tasks";

export type Dimension = "body" | "money" | "work" | "spirit" | "habits";

export type DimensionLine = {
  key: Dimension;
  label: string;
  maslow: string;
  /** Serious skin: plain count for the last 7 days. */
  count: string;
  /** The 7-day ratio behind the RPG stat; null when there is no denominator. */
  ratio: { done: number; total: number } | null;
  /** RPG: all-time XP from real rows. */
  xp: number;
  /** How the XP and stat are worked out, shown on tap. */
  explain: string[];
};

export type Hub = { lines: DimensionLine[]; totalXp: number; prayerStreak: number };

export const XP = {
  task: 10,
  prayer: { jamaah: 15, on_time: 10, clutch: 8, late: 5, missed: 0 },
  dose: 5,
  habit: 5,
  transaction: 2,
  /** Per 1,000 steps. */
  steps: 1,
  workout: 10,
  night: 5,
} as const;

/** Level from XP: 50 XP to reach level 2, each level a little further. */
export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  let floor = 0;
  let span = 50;
  while (xp >= floor + span) {
    floor += span;
    level += 1;
    span = Math.round(span * 1.25);
  }
  return { level, into: xp - floor, span };
}

export function statFor(ratio: DimensionLine["ratio"]): number | null {
  if (!ratio || ratio.total === 0) return null;
  return Math.round(Math.min(1, ratio.done / ratio.total) * 100);
}

/** Days in a row, ending today (or yesterday if today isn't complete), with all five prayed. */
export function prayerStreak(logs: PrayerLog[], today: string): number {
  const prayedByDay = new Map<string, Set<string>>();
  for (const log of logs) {
    const status = statusOf(log);
    if (!status || status === "missed") continue;
    const set = prayedByDay.get(log.prayer_date) ?? new Set<string>();
    set.add(log.prayer_name);
    prayedByDay.set(log.prayer_date, set);
  }
  const full = (day: string) => (prayedByDay.get(day)?.size ?? 0) >= 5;
  let day = full(today) ? today : format(addDays(parseISO(today), -1), "yyyy-MM-dd");
  let streak = 0;
  while (full(day)) {
    streak += 1;
    day = format(addDays(parseISO(day), -1), "yyyy-MM-dd");
  }
  return streak;
}

export function buildHub(args: {
  today: string;
  tasks: Task[];
  prayerLogs: PrayerLog[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  transactions: Transaction[];
  /** Samsung Health (steps, sleep, workouts); optional. */
  healthSamples?: HealthSample[];
  enabled: (dimension: Dimension) => boolean;
}): Hub {
  const from = format(addDays(parseISO(args.today), -6), "yyyy-MM-dd");
  const inWeek = (date: string | null | undefined) => !!date && date >= from && date <= args.today;
  const lines: DimensionLine[] = [];

  if (args.enabled("body")) {
    const slots = args.medications
      .filter((m) => m.active)
      .reduce((sum, m) => sum + new Set(m.schedule_times ?? []).size, 0);
    const taken = args.medicationLogs.filter((log) => log.taken && inWeek(log.log_date)).length;
    const allTaken = args.medicationLogs.filter((log) => log.taken).length;

    const samples = args.healthSamples ?? [];
    const week = lastDays(7, args.today);
    const steps = dailyValues(samples, "steps", week).filter(
      (v): v is number => v != null && v > 0,
    );
    const nights = dailyValues(samples, "sleep", week).filter(
      (v): v is number => v != null && v > 0,
    );
    const workouts = samples.filter(
      (s) => s.kind === "exercise" && inWeek(s.start_at.slice(0, 10)),
    ).length;
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

    const parts: string[] = [];
    if (steps.length) parts.push(`${Math.round(avg(steps)).toLocaleString()} steps a day`);
    if (nights.length) {
      const minutes = avg(nights);
      parts.push(`${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min sleep`);
    }
    if (workouts) parts.push(`${workouts} ${workouts === 1 ? "workout" : "workouts"}`);
    if (slots) parts.push(`${taken} of ${slots * 7} doses`);

    const allSteps = samples.filter((s) => s.kind === "steps").reduce((sum, s) => sum + s.value, 0);
    const allWorkouts = samples.filter((s) => s.kind === "exercise").length;
    const allNights = samples.filter((s) => s.kind === "sleep").length;
    lines.push({
      key: "body",
      label: "Body",
      maslow: "Physiological",
      count: parts.length ? parts.join(" · ") : "Nothing logged",
      // Doses when scheduled; otherwise nights with sleep recorded.
      ratio: slots
        ? { done: taken, total: slots * 7 }
        : nights.length || steps.length
          ? { done: nights.length, total: 7 }
          : null,
      xp:
        allTaken * XP.dose +
        Math.floor(allSteps / 1000) * XP.steps +
        allWorkouts * XP.workout +
        allNights * XP.night,
      explain: [
        `${XP.dose} XP per dose taken, ${XP.steps} XP per 1,000 steps, ${XP.workout} XP per workout, ${XP.night} XP per night of sleep recorded.`,
        slots
          ? "Stat: doses taken in the last 7 days out of doses scheduled."
          : "Stat: nights with sleep recorded in the last 7 days.",
      ],
    });
  }

  if (args.enabled("money")) {
    const logged = args.transactions.filter((t) => inWeek(t.date)).length;
    lines.push({
      key: "money",
      label: "Money",
      maslow: "Safety",
      count: `${logged} ${logged === 1 ? "entry" : "entries"} logged`,
      ratio: {
        done: new Set(args.transactions.filter((t) => inWeek(t.date)).map((t) => t.date)).size,
        total: 7,
      },
      xp: args.transactions.length * XP.transaction,
      explain: [
        `${XP.transaction} XP for every transaction logged (${args.transactions.length} so far).`,
        "Stat: days in the last 7 with at least one money entry.",
      ],
    });
  }

  if (args.enabled("work")) {
    const due = args.tasks.filter(
      (t) => !t.parent_task_id && t.status !== "cancelled" && inWeek(t.due_date),
    );
    const doneWeek = due.filter((t) => t.status === "completed").length;
    const doneAll = args.tasks.filter((t) => t.status === "completed").length;
    lines.push({
      key: "work",
      label: "Work",
      maslow: "Esteem",
      count: due.length ? `${doneWeek} of ${due.length} tasks done` : "No tasks were due",
      ratio: due.length ? { done: doneWeek, total: due.length } : null,
      xp: doneAll * XP.task,
      explain: [
        `${XP.task} XP for every task or step completed (${doneAll} so far).`,
        "Stat: tasks due in the last 7 days that are done.",
      ],
    });
  }

  if (args.enabled("spirit")) {
    const week = args.prayerLogs.filter((log) => inWeek(log.prayer_date));
    const prayed = week.filter((log) => {
      const status = statusOf(log);
      return status && status !== "missed";
    }).length;
    const xp = args.prayerLogs.reduce(
      (sum, log) => sum + (XP.prayer[statusOf(log) ?? "missed"] ?? 0),
      0,
    );
    lines.push({
      key: "spirit",
      label: "Spirit",
      maslow: "Self-actualisation",
      count: `${prayed} of 35 prayers`,
      ratio: { done: prayed, total: 35 },
      xp,
      explain: [
        `XP per prayer: in jamaah ${XP.prayer.jamaah}, on time ${XP.prayer.on_time}, clutch ${XP.prayer.clutch}, late ${XP.prayer.late}.`,
        "Stat: prayers prayed in the last 7 days out of 35.",
      ],
    });
  }

  if (args.enabled("habits")) {
    const daily = args.habits.filter((h) => h.active && h.frequency === "daily");
    const logged = args.habitLogs.filter(
      (log) => inWeek(log.log_date) && daily.some((h) => h.id === log.habit_id),
    ).length;
    lines.push({
      key: "habits",
      label: "Habits",
      maslow: "Growth",
      count: daily.length ? `${logged} of ${daily.length * 7} check-ins` : "No daily habits",
      ratio: daily.length ? { done: logged, total: daily.length * 7 } : null,
      xp: args.habitLogs.length * XP.habit,
      explain: [
        `${XP.habit} XP for every habit check-in (${args.habitLogs.length} so far).`,
        "Stat: daily habit check-ins in the last 7 days out of those possible.",
      ],
    });
  }

  return {
    lines,
    totalXp: lines.reduce((sum, line) => sum + line.xp, 0),
    prayerStreak: args.enabled("spirit") ? prayerStreak(args.prayerLogs, args.today) : 0,
  };
}
