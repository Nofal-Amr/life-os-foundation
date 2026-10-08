/**
 * The honest game layer for the RPG skin. Everything comes from what was
 * logged — no random rewards, no estimated meters:
 * - achievements, each with the day it was actually earned;
 * - titles by level;
 * - daily and weekly quests with progress from today's/this week's rows;
 * - projects as bosses: HP is their tasks, every task done is a hit;
 * - a prayer streak where a week of full days earns a shield that covers
 *   one missed day later;
 * - gold (one per 10 XP) to spend on rewards you set yourself.
 */
import { addDays, format, parseISO, startOfWeek } from "date-fns";

import type { DhikrLog } from "./azkar";
import type { Transaction } from "./finance";
import type { HabitLog } from "./habits";
import type { HealthSample } from "./healthSamples";
import type { Project } from "./projects";
import type { PrayerLog } from "./spirit";
import { statusOf } from "./spirit";
import type { Task } from "./tasks";

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/* ----------------------------------------------------------- achievements */

export type Achievement = {
  id: string;
  title: string;
  description: string;
  /** The day it was earned, or null if not yet. */
  earnedOn: string | null;
  progress: { have: number; need: number };
};

type Sources = {
  tasks: Task[];
  prayerLogs: PrayerLog[];
  habitLogs: HabitLog[];
  transactions: Transaction[];
  dhikrLogs: DhikrLog[];
  healthSamples: HealthSample[];
  projects: Project[];
};

/** The day a running total first reaches `need`, from dated amounts. */
function reachedOn(
  events: { date: string; amount: number }[],
  need: number,
): {
  have: number;
  on: string | null;
} {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  let have = 0;
  let on: string | null = null;
  for (const event of sorted) {
    have += event.amount;
    if (on == null && have >= need) on = event.date;
  }
  return { have, on };
}

function count(
  id: string,
  title: string,
  description: string,
  events: { date: string; amount: number }[],
  need: number,
): Achievement {
  const { have, on } = reachedOn(events, need);
  return { id, title, description, earnedOn: on, progress: { have: Math.min(have, need), need } };
}

/** Days on which all five prayers were prayed (not missed). */
export function fullPrayerDays(logs: PrayerLog[]): string[] {
  const byDay = new Map<string, Set<string>>();
  for (const log of logs) {
    const status = statusOf(log);
    if (!status || status === "missed") continue;
    const set = byDay.get(log.prayer_date) ?? new Set<string>();
    set.add(log.prayer_name);
    byDay.set(log.prayer_date, set);
  }
  return [...byDay.entries()]
    .filter(([, set]) => set.size >= 5)
    .map(([date]) => date)
    .sort();
}

/** Longest run of consecutive days, and the day it first reached `need`. */
function runReached(days: string[], need: number): { best: number; on: string | null } {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  let on: string | null = null;
  for (const date of [...new Set(days)].sort()) {
    run = previous && format(addDays(parseISO(previous), 1), "yyyy-MM-dd") === date ? run + 1 : 1;
    best = Math.max(best, run);
    if (on == null && run >= need) on = date;
    previous = date;
  }
  return { best, on };
}

export function achievements(sources: Sources): Achievement[] {
  const doneTasks = sources.tasks
    .filter((task) => task.status === "completed" && task.completed_at)
    .map((task) => ({ date: day(task.completed_at)!, amount: 1 }));
  const prayed = sources.prayerLogs
    .filter((log) => {
      const status = statusOf(log);
      return status && status !== "missed";
    })
    .map((log) => ({ date: log.prayer_date, amount: 1 }));
  const jamaah = sources.prayerLogs
    .filter((log) => statusOf(log) === "jamaah")
    .map((log) => ({ date: log.prayer_date, amount: 1 }));
  const fullDays = fullPrayerDays(sources.prayerLogs);
  const fullWeek = runReached(fullDays, 7);
  const morning = [
    ...new Set(
      sources.dhikrLogs.filter((log) => log.kind === "morning").map((log) => log.log_date),
    ),
  ].map((date) => ({ date, amount: 1 }));
  const tasbih = sources.dhikrLogs
    .filter((log) => log.kind === "tasbih")
    .map((log) => ({ date: log.log_date, amount: log.count }));
  const money = sources.transactions.map((t) => ({ date: t.date, amount: 1 }));
  const moneyDays = [...new Set(sources.transactions.map((t) => t.date))].map((date) => ({
    date,
    amount: 1,
  }));
  const habits = sources.habitLogs.map((log) => ({ date: log.log_date, amount: 1 }));
  const steps = sources.healthSamples
    .filter((s) => s.kind === "steps")
    .map((s) => ({ date: s.start_at.slice(0, 10), amount: s.value }));
  const workouts = sources.healthSamples
    .filter((s) => s.kind === "exercise")
    .map((s) => ({ date: s.start_at.slice(0, 10), amount: 1 }));
  const projectsDone = sources.projects
    .filter((p) => p.status === "completed")
    .map((p) => ({ date: day(p.updated_at)!, amount: 1 }));

  return [
    count("first-task", "First strike", "Finish a task.", doneTasks, 1),
    count("tasks-50", "Getting things done", "Finish 50 tasks.", doneTasks, 50),
    count("tasks-250", "Unstoppable", "Finish 250 tasks.", doneTasks, 250),
    count("first-prayer", "First step", "Log a prayer as prayed.", prayed, 1),
    {
      id: "full-day",
      title: "A full day",
      description: "Pray all five in one day.",
      earnedOn: fullDays[0] ?? null,
      progress: { have: Math.min(fullDays.length, 1), need: 1 },
    },
    {
      id: "full-week",
      title: "Steadfast",
      description: "All five prayers, seven days in a row.",
      earnedOn: fullWeek.on,
      progress: { have: Math.min(fullWeek.best, 7), need: 7 },
    },
    count("jamaah-40", "With the congregation", "Pray 40 prayers in jamaah.", jamaah, 40),
    count("azkar-7", "Morning light", "Read the morning azkar on 7 days.", morning, 7),
    count("tasbih-1000", "A thousand", "Count 1,000 on the tasbih.", tasbih, 1000),
    count("money-30", "Bookkeeper", "Log 30 money entries.", money, 30),
    count("money-days-30", "Every coin", "Log money on 30 different days.", moneyDays, 30),
    count("habits-100", "Creature of habit", "Check in on habits 100 times.", habits, 100),
    count("steps-100k", "Long road", "Walk 100,000 steps (from your health app).", steps, 100_000),
    count("workouts-10", "In training", "Record 10 workouts.", workouts, 10),
    count("project-done", "Boss down", "Complete a project.", projectsDone, 1),
  ];
}

/* ------------------------------------------------------------------ titles */

export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: "Novice" },
  { level: 3, title: "Apprentice" },
  { level: 6, title: "Journeyman" },
  { level: 10, title: "Adept" },
  { level: 15, title: "Expert" },
  { level: 22, title: "Master" },
  { level: 30, title: "Grandmaster" },
];

export function titleFor(level: number): {
  title: string;
  next: { level: number; title: string } | null;
} {
  let current = TITLES[0]!;
  for (const item of TITLES) if (level >= item.level) current = item;
  const next = TITLES.find((item) => item.level > level) ?? null;
  return { title: current.title, next };
}

/* ------------------------------------------------------------------ quests */

export type Quest = {
  id: string;
  title: string;
  have: number;
  need: number;
  done: boolean;
};

export function dailyQuests(
  sources: Sources,
  today: string,
  has: (area: string) => boolean,
): Quest[] {
  const quests: Quest[] = [];
  const quest = (id: string, title: string, have: number, need: number) =>
    quests.push({ id, title, have: Math.min(have, need), need, done: have >= need });

  if (has("spirit")) {
    const prayed = sources.prayerLogs.filter((log) => {
      const status = statusOf(log);
      return log.prayer_date === today && status && status !== "missed";
    }).length;
    quest("pray-five", "Pray all five", prayed, 5);
    quest(
      "morning-azkar",
      "Read the morning azkar",
      sources.dhikrLogs.some((log) => log.log_date === today && log.kind === "morning") ? 1 : 0,
      1,
    );
  }
  if (has("do")) {
    const done = sources.tasks.filter(
      (task) => task.status === "completed" && day(task.completed_at) === today,
    ).length;
    quest("tasks-three", "Finish 3 tasks", done, 3);
  }
  if (has("money")) {
    quest(
      "log-money",
      "Log what you spent",
      sources.transactions.some((t) => t.date === today) ? 1 : 0,
      1,
    );
  }
  return quests;
}

export function weeklyQuests(
  sources: Sources,
  today: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  has: (area: string) => boolean,
): Quest[] {
  const first = format(startOfWeek(parseISO(today), { weekStartsOn }), "yyyy-MM-dd");
  const inWeek = (date: string | null | undefined) => !!date && date >= first && date <= today;
  const quests: Quest[] = [];
  const quest = (id: string, title: string, have: number, need: number) =>
    quests.push({ id, title, have: Math.min(have, need), need, done: have >= need });

  if (has("spirit")) {
    const prayed = sources.prayerLogs.filter((log) => {
      const status = statusOf(log);
      return inWeek(log.prayer_date) && status && status !== "missed";
    }).length;
    quest("week-prayers", "Pray 30 prayers this week", prayed, 30);
    const mornings = new Set(
      sources.dhikrLogs
        .filter((log) => log.kind === "morning" && inWeek(log.log_date))
        .map((log) => log.log_date),
    ).size;
    quest("week-azkar", "Morning azkar on 5 days", mornings, 5);
  }
  if (has("do")) {
    const done = sources.tasks.filter(
      (task) => task.status === "completed" && inWeek(day(task.completed_at)),
    ).length;
    quest("week-tasks", "Finish 10 tasks", done, 10);
  }
  if (has("body")) {
    const workouts = sources.healthSamples.filter(
      (s) => s.kind === "exercise" && inWeek(s.start_at.slice(0, 10)),
    ).length;
    quest("week-workouts", "4 workouts", workouts, 4);
  }
  return quests;
}

/* ------------------------------------------------------------------ bosses */

export type Boss = { project: Project; hp: number; hits: number; defeated: boolean };

/** Each project with tasks is a boss: HP = its tasks, hits = tasks done. */
export function bosses(projects: Project[], tasks: Task[]): Boss[] {
  return projects
    .filter((project) => project.status !== "archived")
    .map((project) => {
      const own = tasks.filter(
        (task) => task.project_id === project.id && task.status !== "cancelled",
      );
      const hits = own.filter((task) => task.status === "completed").length;
      return {
        project,
        hp: own.length,
        hits,
        defeated: project.status === "completed" || (own.length > 0 && hits === own.length),
      };
    })
    .filter((boss) => boss.hp > 0);
}

/* ------------------------------------------------------- shielded streak */

/**
 * Prayer streak with shields: every 7 full days in a row earn a shield (2 at
 * most); a day that isn't full uses one instead of ending the streak. Today
 * doesn't count against you until it's over.
 */
export function shieldedStreak(
  logs: PrayerLog[],
  today: string,
): { days: number; shields: number } {
  const full = new Set(fullPrayerDays(logs));
  const firstDay = [...full].sort()[0];
  if (!firstDay) return { days: 0, shields: 0 };
  let days = 0;
  let shields = 0;
  let sinceShield = 0;
  for (
    let date = firstDay;
    date <= today;
    date = format(addDays(parseISO(date), 1), "yyyy-MM-dd")
  ) {
    if (full.has(date)) {
      days += 1;
      sinceShield += 1;
      if (sinceShield >= 7) {
        shields = Math.min(2, shields + 1);
        sinceShield = 0;
      }
    } else if (date === today) {
      break; // still today: not over yet
    } else if (shields > 0) {
      shields -= 1; // covered: the streak holds, but the day isn't counted
    } else {
      days = 0;
      sinceShield = 0;
    }
  }
  return { days, shields };
}

/* -------------------------------------------------------------------- gold */

export const XP_PER_GOLD = 10;

export function goldBalance(
  totalXp: number,
  spent: number,
): { earned: number; spent: number; balance: number } {
  const earned = Math.floor(totalXp / XP_PER_GOLD);
  return { earned, spent, balance: earned - spent };
}
