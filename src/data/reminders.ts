/**
 * Phone reminders, worked out here and handed to the Android app, which
 * schedules them as notifications (see src/lib/native.ts).
 */
import { addDays, format, parseISO } from "date-fns";

import type { Reminder } from "@/lib/native";
import type { Task } from "./tasks";

export type ReminderSettings = {
  /** Prayer reminders. */
  enabled: boolean;
  leadMinutes: number;
  /** A second notification exactly at the prayer time ("Maghrib is now"). */
  atTime: boolean;
  /**
   * "Clutch": if a prayer still isn't logged 5 minutes before its time runs
   * out (sunrise for Fajr, the next prayer for the rest), one last nudge.
   */
  clutch: boolean;
  /** A daily summary of tasks due that day. */
  tasksEnabled: boolean;
  /** "HH:mm", local time. */
  taskTime: string;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  leadMinutes: 10,
  atTime: true,
  clutch: true,
  tasksEnabled: true,
  taskTime: "09:00",
};

/** Tasks due (or, for today, overdue) and still open, top-level only. */
function openTasksFor(tasks: Task[], date: string, today: string): Task[] {
  return tasks.filter((task) => {
    if (task.parent_task_id && !task.due_date) return false;
    if (task.status === "completed" || task.status === "cancelled") return false;
    if (!task.due_date) return false;
    return date === today ? task.due_date <= today : task.due_date === date;
  });
}

/**
 * One notification per day for the next `days` days at `time`, listing what
 * is due. Days with nothing due get no notification; times already past are
 * skipped.
 */
export function taskReminders(args: {
  tasks: Task[];
  today: string;
  time: string;
  now: number;
  days?: number;
}): Reminder[] {
  const [hours = 9, minutes = 0] = args.time.split(":").map(Number);
  const reminders: Reminder[] = [];
  for (let offset = 0; offset < (args.days ?? 7); offset++) {
    const date = format(addDays(parseISO(args.today), offset), "yyyy-MM-dd");
    const at = parseISO(date);
    at.setHours(hours, minutes, 0, 0);
    if (at.getTime() <= args.now) continue;
    const due = openTasksFor(args.tasks, date, args.today);
    if (!due.length) continue;
    const names = due.slice(0, 3).map((task) => task.title);
    const more = due.length > 3 ? ` and ${due.length - 3} more` : "";
    reminders.push({
      id: `tasks-${date}`,
      at: at.getTime(),
      title: `${due.length} ${due.length === 1 ? "task" : "tasks"} due today`,
      body: `${names.join(", ")}${more}.`,
      path: "/week",
      channel: "tasks",
    });
  }
  return reminders;
}
