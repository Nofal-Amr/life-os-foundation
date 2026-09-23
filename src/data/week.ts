/**
 * The Week view: counts of real rows per day. Every figure is "logged of
 * scheduled" with a stored denominator — no scores, no composite percentages.
 *
 * Where a task sits in the week:
 * - Done: on the day it was completed (completed_at), else its due day.
 * - Open: on its due day. Open tasks that are overdue sit on today.
 * - A task split into dated parts (steps) is shown as those parts instead.
 * Open tasks due later in the week can be done early from any earlier day;
 * they only count toward the day they are due (or done).
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

import type { Transaction } from "./finance";
import type { Habit, HabitLog } from "./habits";
import type { PrayerLog } from "./spirit";
import { PRAYER_NAMES } from "./spirit";
import type { Task } from "./tasks";

export type Fraction = { done: number; total: number };
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The usual choices first; the rest are for shift work and other weeks. */
export const WEEK_START_OPTIONS: { value: WeekStartsOn; label: string }[] = [
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
];

export const OTHER_WEEK_START_OPTIONS: { value: WeekStartsOn; label: string }[] = [
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

export function toWeekStartsOn(value: number | null | undefined): WeekStartsOn {
  return value != null && Number.isInteger(value) && value >= 0 && value <= 6
    ? (value as WeekStartsOn)
    : 1;
}

export type WeekDay = {
  date: string;
  /** Tasks placed on this day (see the rules above). */
  tasks: Task[];
  /** Open tasks due later this week that can be done early from this day. */
  dueLater: Task[];
  tasksDone: Fraction;
  habits: Fraction;
  prayers: Fraction;
  /** Money out that day, as a positive number. */
  spent: number;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
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

export function weekStart(anchor: string, weekStartsOn: WeekStartsOn = 1): string {
  return iso(startOfWeek(parseISO(anchor), { weekStartsOn }));
}

export function shiftWeek(start: string, weeks: number): string {
  return iso(addDays(parseISO(start), weeks * 7));
}

/** The local calendar day of a timestamp. */
function localDay(timestamp: string | null): string | null {
  return timestamp ? iso(new Date(timestamp)) : null;
}

/** The day a task belongs to in the week, or null when it has no place. */
export function placeTask(task: Task, today: string): string | null {
  if (task.status === "cancelled") return null;
  if (isDone(task)) return localDay(task.completed_at) ?? task.due_date;
  if (!task.due_date) return null;
  return task.due_date < today ? today : task.due_date;
}

/** Tasks to show: dated parts replace their parent task. */
export function weekTasks(tasks: Task[]): Task[] {
  const parentsWithDatedParts = new Set(
    tasks
      .filter((task) => task.parent_task_id && task.due_date)
      .map((task) => task.parent_task_id!),
  );
  return tasks.filter((task) =>
    task.parent_task_id ? !!task.due_date : !parentsWithDatedParts.has(task.id),
  );
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
  const dates = Array.from({ length: 7 }, (_, index) => iso(addDays(parseISO(args.start), index)));
  const end = dates[6]!;

  const placed = new Map<string, Task[]>();
  for (const task of weekTasks(args.tasks)) {
    const day = placeTask(task, args.today);
    if (day && day >= args.start && day <= end) placed.set(day, [...(placed.get(day) ?? []), task]);
  }

  const days: WeekDay[] = dates.map((date) => {
    const tasks = placed.get(date) ?? [];
    const dueLater =
      date >= args.today
        ? dates
            .filter((later) => later > date)
            .flatMap((later) => placed.get(later) ?? [])
            .filter((task) => !isDone(task))
        : [];
    const habitsLogged = new Set(
      args.habitLogs
        .filter((log) => log.log_date === date && habitIds.has(log.habit_id))
        .map((log) => log.habit_id),
    ).size;
    const prayersLogged = args.trackPrayers
      ? new Set(
          args.prayerLogs
            .filter((log) => log.prayer_date === date && prayerCounts(log))
            .map((log) => log.prayer_name),
        ).size
      : 0;
    const spent = args.transactions
      .filter((t) => t.date === date && t.kind === "expense")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    return {
      date,
      tasks,
      dueLater,
      tasksDone: { done: tasks.filter(isDone).length, total: tasks.length },
      habits: { done: habitsLogged, total: dailyHabits.length },
      prayers: { done: prayersLogged, total: args.trackPrayers ? PRAYER_NAMES.length : 0 },
      spent,
      isToday: date === args.today,
      isFuture: date > args.today,
      isPast: date < args.today,
    };
  });

  const add = (list: WeekDay[], pick: (day: WeekDay) => Fraction): Fraction =>
    list.reduce(
      (acc, day) => ({ done: acc.done + pick(day).done, total: acc.total + pick(day).total }),
      { done: 0, total: 0 },
    );
  // Habits and prayers only count days that have started: a future day
  // can't have been logged yet, so it isn't part of the denominator.
  const started = days.filter((day) => !day.isFuture);

  return {
    start: args.start,
    end,
    days,
    tasks: add(days, (day) => day.tasksDone),
    habits: add(started, (day) => day.habits),
    prayers: add(started, (day) => day.prayers),
    spent: days.reduce((total, day) => total + day.spent, 0),
  };
}

/** A prayer counts as prayed when it has a status other than missed. */
export function prayerCounts(log: PrayerLog): boolean {
  if (log.status) return log.status !== "missed";
  return log.completed;
}

/**
 * Splits a task's estimate evenly over the days from `from` to its due date,
 * in whole minutes. With no estimate, each part gets null minutes.
 */
export function splitPlan(args: {
  from: string;
  due: string;
  parts: number;
  estimatedMinutes: number | null;
}): { date: string; minutes: number | null }[] {
  const span = Math.max(1, differenceInCalendarDays(parseISO(args.due), parseISO(args.from)) + 1);
  const parts = Math.max(1, Math.min(args.parts, span));
  // Spread the parts across the span, always ending on the due date.
  const dates = Array.from({ length: parts }, (_, index) => {
    const offset = parts === 1 ? span - 1 : Math.round((index * (span - 1)) / (parts - 1));
    return iso(addDays(parseISO(args.from), offset));
  });
  const total = args.estimatedMinutes;
  return dates.map((date, index) => ({
    date,
    minutes: total == null ? null : Math.floor(total / parts) + (index < total % parts ? 1 : 0),
  }));
}

/** Plain-language recap from the counts; nothing inferred or judged. */
export function weekRecap(week: Week, fmtMoney: (value: number) => string): string[] {
  const lines: string[] = [];
  if (week.tasks.total) {
    lines.push(`${week.tasks.done} of ${week.tasks.total} tasks this week are done.`);
  }
  const busiest = [...week.days].sort((a, b) => b.tasksDone.done - a.tasksDone.done)[0];
  if (busiest && busiest.tasksDone.done > 1) {
    lines.push(
      `Most tasks finished on ${format(parseISO(busiest.date), "EEEE")} (${busiest.tasksDone.done}).`,
    );
  }
  if (week.habits.total) {
    lines.push(`${week.habits.done} of ${week.habits.total} daily habit check-ins logged so far.`);
  }
  if (week.prayers.total) {
    lines.push(`${week.prayers.done} of ${week.prayers.total} prayers logged so far.`);
  }
  if (week.spent > 0) {
    const days = week.days.filter((day) => day.spent > 0).length;
    lines.push(`${fmtMoney(week.spent)} spent across ${days} ${days === 1 ? "day" : "days"}.`);
  }
  return lines;
}
