/**
 * Closing the day: the open tasks dated today or earlier, so the user can
 * move them to tomorrow in one tap instead of letting them pile up.
 * Nothing is judged; a moved task is just a task with a new date.
 */
import { addDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { isOpen, updateTask, type Task } from "@/data/tasks";

/** From this hour on, Today offers to close the day. */
export const EVENING_HOUR = 18;

export function isEvening(now = new Date()): boolean {
  return now.getHours() >= EVENING_HOUR;
}

export function nextDay(date: string): string {
  return format(addDays(parseISO(date), 1), "yyyy-MM-dd");
}

/** Open, top-level tasks dated on or before `date`, oldest first. */
export function carryOver(tasks: Task[], date: string): Task[] {
  return tasks
    .filter(
      (task) => isOpen(task) && !task.parent_task_id && !!task.due_date && task.due_date <= date,
    )
    .sort(
      (a, b) =>
        (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
        (a.due_time ?? "99").localeCompare(b.due_time ?? "99"),
    );
}

/** Move each task to the day after `date`; returns them as they were, for undo. */
export async function moveToTomorrow(tasks: Task[], date: string): Promise<Task[]> {
  const tomorrow = nextDay(date);
  await Promise.all(tasks.map((task) => updateTask(task.id, { due_date: tomorrow }, task)));
  return tasks;
}

/** Undo a move: put back the dates and the postpone counts exactly as they were. */
export async function restoreTasks(previous: Task[]): Promise<void> {
  await Promise.all(
    previous.map(async (task) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          due_date: task.due_date,
          postponed_count: task.postponed_count,
          last_postponed_at: task.last_postponed_at,
          original_due_date: task.original_due_date,
        })
        .eq("id", task.id);
      if (error) throw error;
    }),
  );
}
