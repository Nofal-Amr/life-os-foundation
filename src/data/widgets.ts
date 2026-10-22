/** What the home-screen widgets show as the one next thing to do. */
import { differenceInCalendarDays, parseISO } from "date-fns";

import { isOpen, type Task } from "./tasks";

const NOTHING = { next: "Nothing to do right now", nextDetail: "Open Life OS to add a task" };

/** Overdue first (oldest), then due today (earliest time), then the soonest upcoming. */
export function widgetNextAction(tasks: Task[], today: string): { next: string; nextDetail: string } {
  const open = tasks
    .filter((task) => isOpen(task) && !task.parent_task_id && task.due_date)
    .sort(
      (a, b) =>
        a.due_date!.localeCompare(b.due_date!) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
    );
  const first = open[0];
  if (!first) return NOTHING;
  const days = differenceInCalendarDays(parseISO(first.due_date!), parseISO(today));
  const time = first.due_time ? ` · ${first.due_time.slice(0, 5)}` : "";
  const nextDetail =
    days < 0
      ? `${-days} ${days === -1 ? "day" : "days"} late`
      : days === 0
        ? `Due today${time}`
        : days === 1
          ? `Tomorrow${time}`
          : `In ${days} days`;
  return { next: first.title, nextDetail };
}
