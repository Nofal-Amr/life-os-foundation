/**
 * Reminders that aren't tasks: "call the bank at 3", "take the bins out every
 * Thursday". A repeating reminder keeps one row; its next time is worked out
 * from the first one, so nothing piles up.
 */
import { queryOptions } from "@tanstack/react-query";
import { addDays, addMonths, addWeeks } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Reminder as NativeReminder } from "@/lib/native";
import { currentUserId, unwrap } from "@/lib/supabase-helpers";

export type UserReminder = Database["public"]["Tables"]["reminders"]["Row"];
export type ReminderRepeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

export type ReminderInput = {
  title: string;
  note?: string | null;
  remind_at: string;
  repeat: ReminderRepeat;
};

export const userReminderKeys = { all: ["reminders"] as const };

export const userRemindersQuery = () =>
  queryOptions({
    queryKey: userReminderKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("reminders").select("*").order("remind_at", { ascending: true }),
      ) as UserReminder[],
  });

export async function createReminder(input: ReminderInput): Promise<UserReminder> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("reminders")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as UserReminder;
}

export async function updateReminder(
  id: string,
  input: Partial<ReminderInput> & { done_at?: string | null },
): Promise<UserReminder> {
  return unwrap(
    await supabase.from("reminders").update(input).eq("id", id).select().single(),
  ) as UserReminder;
}

export async function deleteReminder(id: string): Promise<void> {
  unwrap(await supabase.from("reminders").delete().eq("id", id).select());
}

function step(date: Date, repeat: ReminderRepeat): Date {
  if (repeat === "daily") return addDays(date, 1);
  if (repeat === "weekly") return addWeeks(date, 1);
  if (repeat === "monthly") return addMonths(date, 1);
  if (repeat === "weekdays") {
    let next = addDays(date, 1);
    while (next.getDay() === 5 || next.getDay() === 6) next = addDays(next, 1);
    return next;
  }
  return date;
}

/**
 * The next times a reminder rings after `from`, at most `limit`. A one-off
 * reminder rings once; a done one-off never again. Weekdays skip Friday and
 * Saturday, the weekend here.
 */
export function upcomingTimes(
  reminder: Pick<UserReminder, "remind_at" | "repeat" | "done_at">,
  from: Date,
  limit = 1,
  until?: Date,
): Date[] {
  const repeat = (reminder.repeat as ReminderRepeat) ?? "none";
  let at = new Date(reminder.remind_at);
  if (repeat === "none") {
    return !reminder.done_at && at > from && (!until || at <= until) ? [at] : [];
  }
  // For repeats, "done" means done for that time; ring again at the next one.
  const doneAt = reminder.done_at ? new Date(reminder.done_at) : null;
  const times: Date[] = [];
  for (let guard = 0; guard < 2000 && times.length < limit; guard++) {
    if (until && at > until) break;
    const skippedAsDone = doneAt && at <= doneAt;
    const weekend = repeat === "weekdays" && (at.getDay() === 5 || at.getDay() === 6);
    if (at > from && !skippedAsDone && !weekend) times.push(at);
    at = step(at, repeat);
  }
  return times;
}

/** Whether a reminder still has anything ahead of it. */
export function isActiveReminder(reminder: UserReminder, now = new Date()): boolean {
  return upcomingTimes(reminder, now, 1).length > 0;
}

/** Phone notifications for the next `days` days. */
export function reminderNotifications(
  reminders: UserReminder[],
  now: number,
  days = 7,
): NativeReminder[] {
  const from = new Date(now);
  const until = new Date(now + days * 86_400_000);
  return reminders.flatMap((reminder) =>
    upcomingTimes(reminder, from, 14, until).map((at) => ({
      id: `reminder-${reminder.id}-${at.getTime()}`,
      at: at.getTime(),
      title: reminder.title,
      body: reminder.note?.trim() || "Reminder",
      path: "/reminders",
      channel: "tasks" as const,
    })),
  );
}
