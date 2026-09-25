/**
 * Today's focus list: what to do, grouped by when, in plain words. Late
 * things are "from earlier", never red or "overdue".
 */
import { differenceInCalendarDays, format, parseISO } from "date-fns";

export type FocusGroup = "earlier" | "today" | "soon";

export const FOCUS_GROUP_LABELS: Record<FocusGroup, string> = {
  earlier: "From earlier",
  today: "Today",
  soon: "Coming up",
};

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "4 days ago", or a date. */
export function relativeDay(date: string, today: string): string {
  const days = differenceInCalendarDays(parseISO(date), parseISO(today));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -30) return `${-days} days ago`;
  return format(parseISO(date), "d MMM");
}

/** Which group a due date belongs to; null when it's further out than `soonDays`. */
export function focusGroup(due: string | null, today: string, soonDays = 3): FocusGroup | null {
  if (!due) return null;
  if (due < today) return "earlier";
  if (due === today) return "today";
  return differenceInCalendarDays(parseISO(due), parseISO(today)) <= soonDays ? "soon" : null;
}
