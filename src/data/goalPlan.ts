/**
 * From a goal to dated steps: the steps you list are spread, in order, over
 * the weeks between today and the goal's date, so each week holds a similar
 * share of the work. Nothing is guessed: a step's time is what you typed, and
 * the weekly load is worked out from those times only.
 */
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { format } from "@/lib/dates";

import { splitTaskLines } from "./tasks";

export type PlanStep = { title: string; minutes: number | null };

export type PlannedStep = PlanStep & { week: number; start: string; due: string };

export type PlanWeek = { start: string; end: string; minutes: number; steps: number };

export type GoalPlan = {
  steps: PlannedStep[];
  weeks: PlanWeek[];
  /** The typed times added up. */
  totalMinutes: number;
  /** Steps with no time typed, which the totals leave out. */
  untimed: number;
  /** The typed time per week, spread evenly; null with no times. */
  minutesPerWeek: number | null;
  /** Against the hours you set: whether it fits, and when it would end if not. */
  fits: boolean | null;
  endAtBudget: string | null;
};

const DURATION =
  /\s*(?:[·•|,(\-–—]\s*)?((?:\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|hours?|ساعة|ساعات|س)\s*)?(?:\d+\s*(?:m|min|mins|minutes?|دقيقة|دقائق|د))?)\)?\s*$/i;

/** "1h 30m", "1.5h", "45 min", "2 hours", "٣٠ دقيقة" to minutes; null for anything else. */
export function readDuration(text: string): number | null {
  const value = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim()
    .toLowerCase();
  const match =
    /^(?:(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?|ساعة|ساعات|س))?\s*(?:(\d+)\s*(?:m|min|mins|minutes?|دقيقة|دقائق|د))?$/.exec(
      value,
    );
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Math.round(
    Number((match[1] ?? "0").replace(",", ".")) * 60 + Number(match[2] ?? 0),
  );
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

/** One step per line; a time at the end ("Read chapter 1 · 45m") is the step's estimate. */
export function parseSteps(text: string, max = 50): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const line of splitTaskLines(text, max)) {
    const match = DURATION.exec(line);
    const minutes = match?.[1] ? readDuration(match[1]) : null;
    const title = minutes != null && match ? line.slice(0, match.index).trim() : line;
    if (title) steps.push({ title, minutes });
  }
  return steps;
}

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * What is still open under a goal: its open linked tasks, the times typed on
 * them, and how many of them have no time. Steps of a task count through
 * their parent task, so nothing is counted twice.
 */
export function workLeft(
  tasks: {
    goal_id: string | null;
    status: string;
    estimated_minutes: number | null;
    parent_task_id: string | null;
  }[],
  goalId: string,
): { open: number; minutes: number; untimed: number } {
  const open = tasks.filter(
    (task) =>
      task.goal_id === goalId &&
      !task.parent_task_id &&
      task.status !== "completed" &&
      task.status !== "cancelled",
  );
  return {
    open: open.length,
    minutes: open.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0),
    untimed: open.filter((task) => task.estimated_minutes == null).length,
  };
}

/**
 * Spreads the steps over 7-day blocks from `from` to `until`, keeping their
 * order. A step without a time weighs as much as the average timed step (or
 * all weigh the same when none has a time). Each step starts on its block's
 * first day and is due on its last.
 */
export function planGoal(input: {
  steps: PlanStep[];
  from: string;
  until: string;
  hoursPerWeek?: number | null;
}): GoalPlan | null {
  const { steps, from, until } = input;
  const days = differenceInCalendarDays(parseISO(until), parseISO(from)) + 1;
  if (!steps.length || days < 1) return null;
  const weekCount = Math.ceil(days / 7);
  const weeks: PlanWeek[] = Array.from({ length: weekCount }, (_, index) => {
    const start = addDays(parseISO(from), index * 7);
    const end = index === weekCount - 1 ? parseISO(until) : addDays(start, 6);
    return { start: iso(start), end: iso(end), minutes: 0, steps: 0 };
  });

  const timed = steps.filter((step) => step.minutes != null);
  const totalMinutes = timed.reduce((sum, step) => sum + step.minutes!, 0);
  const average = timed.length ? totalMinutes / timed.length : 1;
  const weight = (step: PlanStep) => step.minutes ?? average;
  const totalWeight = steps.reduce((sum, step) => sum + weight(step), 0);

  let before = 0;
  const planned = steps.map((step) => {
    const middle = before + weight(step) / 2;
    before += weight(step);
    const index = Math.min(weekCount - 1, Math.floor((middle / totalWeight) * weekCount));
    const week = weeks[index]!;
    week.steps += 1;
    week.minutes += step.minutes ?? 0;
    return { ...step, week: index, start: week.start, due: week.end };
  });

  // A short last block counts as part of a week.
  const weekShare = days / 7;
  const minutesPerWeek = timed.length ? Math.round(totalMinutes / weekShare) : null;
  const budget = input.hoursPerWeek && input.hoursPerWeek > 0 ? input.hoursPerWeek * 60 : null;
  const fits = budget == null || minutesPerWeek == null ? null : minutesPerWeek <= budget;
  const endAtBudget =
    fits === false && budget
      ? iso(addDays(parseISO(from), Math.ceil((totalMinutes / budget) * 7) - 1))
      : null;

  return {
    steps: planned,
    weeks,
    totalMinutes,
    untimed: steps.length - timed.length,
    minutesPerWeek,
    fits,
    endAtBudget,
  };
}
