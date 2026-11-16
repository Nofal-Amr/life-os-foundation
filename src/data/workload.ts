/**
 * What today holds: the open work due today and the times typed on it, next to
 * the time actually left in the day. Facts only — no target, no score; the
 * person decides what to move.
 */
import { notStartedYet, type Task } from "./tasks";

export type TodayWorkload = {
  /** Open tasks and steps due today. */
  count: number;
  /** Their typed estimates added up. */
  minutes: number;
  /** How many have no estimate, so `minutes` leaves them out. */
  untimed: number;
  /** Minutes from now until midnight. */
  leftMinutes: number;
  /** The typed estimates alone are more than the time left today. */
  over: boolean;
};

const isOpenTask = (task: Task) => task.status !== "completed" && task.status !== "cancelled";

/**
 * A task split into steps counts through its open steps, so the same work is
 * never counted twice.
 */
export function todayWorkload(tasks: Task[], today: string, now: Date): TodayWorkload {
  const withOpenSteps = new Set(
    tasks
      .filter((task) => task.parent_task_id && isOpenTask(task))
      .map((task) => task.parent_task_id),
  );
  const due = tasks.filter(
    (task) =>
      isOpenTask(task) &&
      task.due_date === today &&
      !notStartedYet(task, today) &&
      !withOpenSteps.has(task.id),
  );
  const minutes = due.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const leftMinutes = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60_000));
  return {
    count: due.length,
    minutes,
    untimed: due.filter((task) => task.estimated_minutes == null).length,
    leftMinutes,
    over: minutes > leftMinutes,
  };
}
