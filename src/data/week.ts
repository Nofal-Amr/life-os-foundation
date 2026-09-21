/**
 * The Week view: counts of real rows per day. Every figure is "logged of
 * scheduled" with a stored denominator — no scores, no composite percentages.
 */
import { addDays, format, parseISO, startOfWeek } from "date-fns";

import type { Transaction } from "./finance";
import type { Habit, HabitLog } from "./habits";
import type { PrayerLog } from "./spirit";
import { PRAYER_NAMES } from "./spirit";
import type { Task } from "./tasks";
import { isStep } from "./tasks";

export type Fraction = { done: number; total: number };

export type WeekDay = {
  date: string;
  /** Top-level tasks due that day. */
  tasks: Task[];
  tasksDone: Fraction;
  habits: Fraction;
  prayers: Fraction;
  /** Money out that day, as a positive number. */
  spent: number;
  isToday: boolean;
  isFuture: boolean;
};

export type Week = {
  start: string;
  end: string;
  days: WeekDay[];
  tasks: Fraction;
  habits: Fraction;
  prayers: Fraction;
  spent: number;
};

const iso = (date: Date) => format(date, "yyyy-MM-dd");

export function isDone(task: Task): boolean {
  return task.status === "completed";
}

export function weekStart(anchor: string, weekStartsOn: 0 | 1 | 6 = 1): string {
  return iso(startOfWeek(parseISO(anchor), { weekStartsOn }));
}

export function shiftWeek(start: string, weeks: number): string {
  return iso(addDays(parseISO(start), weeks * 7));
}

export function buildWeek(args: {
  start: string;
  today: string;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  prayerLogs: PrayerLog[];
  transactions: Transaction[];
  /** Whether prayers are tracked; when false they count as 0 of 0. */
  trackPrayers: boolean;
}): Week {
  const dailyHabits = args.habits.filter((habit) => habit.active && habit.frequency === "daily");
  const habitIds = new Set(dailyHabits.map((habit) => habit.id));

  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = iso(addDays(parseISO(args.start), index));
    const due = args.tasks.filter(
      (task) => !isStep(task) && task.due_date === date && task.status !== "cancelled",
    );
    const habitsLogged = new Set(
      args.habitLogs
        .filter((log) => log.log_date === date && habitIds.has(log.habit_id))
        .map((log) => log.habit_id),
    ).size;
    const prayersLogged = args.trackPrayers
      ? new Set(
          args.prayerLogs
            .filter((log) => log.prayer_date === date && log.completed)
            .map((log) => log.prayer_name),
        ).size
      : 0;
    const spent = args.transactions
      .filter((t) => t.date === date && t.kind === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    return {
      date,
      tasks: due,
      tasksDone: { done: due.filter(isDone).length, total: due.length },
      habits: { done: habitsLogged, total: dailyHabits.length },
      prayers: { done: prayersLogged, total: args.trackPrayers ? PRAYER_NAMES.length : 0 },
      spent,
      isToday: date === args.today,
      isFuture: date > args.today,
    };
  });

  const sum = (pick: (day: WeekDay) => Fraction): Fraction =>
    days.reduce(
      (acc, day) => ({ done: acc.done + pick(day).done, total: acc.total + pick(day).total }),
      {
        done: 0,
        total: 0,
      },
    );

  // Habits and prayers only count days that have started: a future day
  // can't have been logged yet, so it isn't part of the denominator.
  const started = (pick: (day: WeekDay) => Fraction): Fraction => {
    const past = days.filter((day) => !day.isFuture);
    return past.reduce(
      (acc, day) => ({ done: acc.done + pick(day).done, total: acc.total + pick(day).total }),
      {
        done: 0,
        total: 0,
      },
    );
  };

  return {
    start: args.start,
    end: days[6]!.date,
    days,
    tasks: sum((day) => day.tasksDone),
    habits: started((day) => day.habits),
    prayers: started((day) => day.prayers),
    spent: days.reduce((total, day) => total + day.spent, 0),
  };
}

/** Plain-language recap from the counts; nothing inferred or judged. */
export function weekRecap(week: Week, fmtMoney: (value: number) => string): string[] {
  const lines: string[] = [];
  if (week.tasks.total)
    lines.push(`${week.tasks.done} of ${week.tasks.total} tasks due this week are done.`);
  const busiest = [...week.days].sort((a, b) => b.tasksDone.done - a.tasksDone.done)[0];
  if (busiest && busiest.tasksDone.done > 1) {
    lines.push(
      `Most tasks finished on ${format(parseISO(busiest.date), "EEEE")} (${busiest.tasksDone.done}).`,
    );
  }
  if (week.habits.total)
    lines.push(`${week.habits.done} of ${week.habits.total} daily habit check-ins logged so far.`);
  if (week.prayers.total)
    lines.push(`${week.prayers.done} of ${week.prayers.total} prayers logged so far.`);
  if (week.spent > 0) {
    const days = week.days.filter((day) => day.spent > 0).length;
    lines.push(`${fmtMoney(week.spent)} spent across ${days} ${days === 1 ? "day" : "days"}.`);
  }
  return lines;
}

export function ratio({ done, total }: Fraction): number {
  return total > 0 ? done / total : 0;
}
