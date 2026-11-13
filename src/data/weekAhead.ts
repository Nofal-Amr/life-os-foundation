import { addDays, format, parseISO } from "date-fns";

import type { CalendarEvent } from "@/data/events";
import type { RecurringCost } from "@/data/finance";
import { isOpen, isStep, type Task } from "@/data/tasks";

/**
 * Week, looking ahead: the next seven days, each with what is due, what is
 * on, and which bills are expected. Only real rows; a bill is a projection
 * until it is logged, and says so.
 */

export type AheadDay = {
  date: string;
  isToday: boolean;
  /** Open tasks due this day. On today, also the ones from earlier. */
  tasks: Task[];
  /** How many of `tasks` were due before today. */
  fromEarlier: number;
  events: CalendarEvent[];
  bills: RecurringCost[];
};

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/** The local calendar day an event starts on. */
export function eventDay(event: Pick<CalendarEvent, "start_at">): string {
  return iso(new Date(event.start_at));
}

export function buildAhead(args: {
  from: string;
  today: string;
  days?: number;
  tasks: Task[];
  events: CalendarEvent[];
  bills: RecurringCost[];
}): AheadDay[] {
  const count = args.days ?? 7;
  const dates = Array.from({ length: count }, (_, i) => iso(addDays(parseISO(args.from), i)));
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const showsToday = dates.includes(args.today);

  // A dated step is planned on its own; its parent is not shown twice.
  const open = args.tasks.filter((task) => isOpen(task) && task.due_date);
  const plannedParents = new Set(
    open.filter((task) => isStep(task)).map((task) => task.parent_task_id),
  );
  const shown = open.filter((task) => isStep(task) || !plannedParents.has(task.id));

  return dates.map((date) => {
    const isToday = date === args.today;
    const due = shown.filter((task) => task.due_date === date);
    const earlier =
      isToday && showsToday ? shown.filter((task) => task.due_date! < args.today) : [];
    const byTime = (a: Task, b: Task) =>
      (a.due_time ?? "99").localeCompare(b.due_time ?? "99") || a.title.localeCompare(b.title);
    return {
      date,
      isToday,
      tasks: [...earlier.sort(byTime), ...due.sort(byTime)],
      fromEarlier: earlier.length,
      events: args.events
        .filter((event) => eventDay(event) === date)
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
      bills: args.bills.filter(
        (bill) =>
          bill.active &&
          bill.next_due_date === date &&
          bill.next_due_date >= first &&
          bill.next_due_date <= last,
      ),
    };
  });
}

/**
 * Tasks you can plan onto a day: open, not a step, and either without a
 * date (Unsorted) or due after that day (Upcoming).
 */
export function plannable(tasks: Task[], day: string): { unsorted: Task[]; upcoming: Task[] } {
  const candidates = tasks.filter((task) => isOpen(task) && !isStep(task));
  return {
    unsorted: candidates
      .filter((task) => !task.due_date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    upcoming: candidates
      .filter((task) => task.due_date && task.due_date > day)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!)),
  };
}

/** Planning gives the task a day; an unsorted (inbox) task becomes a to-do. */
export function planPatch(task: Pick<Task, "status">, day: string) {
  return task.status === "inbox" ? { due_date: day, status: "todo" as const } : { due_date: day };
}
