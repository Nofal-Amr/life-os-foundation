/**
 * Tasks that have been waiting a long time without moving: the ones an ADHD
 * brain tends to build a "Wall of Awful" around (the idea is from How to
 * ADHD: each time a task is put off, it gets heavier to face).
 *
 * Only facts from the task itself are used: when it was made, when it was
 * last touched, how often its date was moved, and whether any of its steps
 * got done lately. Nothing is scored.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";

import type { Task } from "./tasks";

/** How long a task has to be around before it can count as stuck. */
export const STUCK_AFTER_DAYS = 14;

export type StuckReason = "postponed" | "overdue" | "untouched";

export type StuckTask = {
  task: Task;
  /** Days since the task was made. */
  days: number;
  reason: StuckReason;
};

const OPEN: Task["status"][] = ["inbox", "todo", "in_progress"];

function daysSince(iso: string | null | undefined, today: Date): number | null {
  if (!iso) return null;
  return differenceInCalendarDays(today, parseISO(iso));
}

/**
 * Open top-level tasks at least two weeks old that haven't moved: no step done
 * in the last week, and either untouched for two weeks, moved twice or more,
 * or a week past their date. Oldest first. "Waiting" tasks are left out:
 * that's already a decision.
 */
export function stuckTasks(tasks: Task[], today: string): StuckTask[] {
  const now = parseISO(today);
  const recentStep = new Set<string>();
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    const done = daysSince(task.completed_at, now);
    if (done != null && done <= 7) recentStep.add(task.parent_task_id);
  }

  const stuck: StuckTask[] = [];
  for (const task of tasks) {
    if (task.parent_task_id || !OPEN.includes(task.status)) continue;
    const age = daysSince(task.created_at, now);
    if (age == null || age < STUCK_AFTER_DAYS || recentStep.has(task.id)) continue;
    const pastDue = task.due_date ? differenceInCalendarDays(now, parseISO(task.due_date)) : null;
    const untouched = daysSince(task.updated_at, now) ?? age;
    let reason: StuckReason | null = null;
    if ((task.postponed_count ?? 0) >= 2) reason = "postponed";
    else if (pastDue != null && pastDue >= 7) reason = "overdue";
    else if (untouched >= STUCK_AFTER_DAYS) reason = "untouched";
    if (reason) stuck.push({ task, days: age, reason });
  }
  return stuck.sort((a, b) => b.days - a.days);
}

/** A plain description of why it's shown, from the task's own record. */
export function stuckDetail(item: StuckTask): string {
  const moved = item.task.postponed_count ?? 0;
  if (item.reason === "postponed") return `Moved ${moved} times`;
  if (item.reason === "overdue") return "Past its date";
  return "Not touched in a while";
}

/* "Not today": hidden until tomorrow, on this device only. */

const SNOOZE_KEY = "lifeos:stuck-snooze";

function readSnoozes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function isSnoozed(taskId: string, today: string): boolean {
  return readSnoozes()[taskId] === today;
}

export function snoozeForToday(taskId: string, today: string): void {
  const snoozes = Object.fromEntries(
    Object.entries(readSnoozes()).filter(([, day]) => day === today),
  );
  snoozes[taskId] = today;
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozes));
  } catch {
    // Shown again next time, then.
  }
}
