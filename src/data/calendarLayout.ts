/**
 * Placing timed items on a day's time grid (Week and Day views): minutes from
 * midnight for top and height, and side-by-side columns where items overlap,
 * the way Google Calendar lays them out.
 */
import { addDays, startOfDay } from "date-fns";

export type Timed = { id: string; start: Date; end: Date | null };
export type Block = { id: string; top: number; height: number; column: number; columns: number };

/** Items with no end, or very short ones, still get a block this tall. */
export const MIN_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

export function layoutTimed(items: Timed[], day: Date): Block[] {
  const midnight = startOfDay(day).getTime();
  const spans = items
    .map((item) => {
      const top = Math.max(0, Math.round((item.start.getTime() - midnight) / 60_000));
      const endMinutes = item.end ? Math.round((item.end.getTime() - midnight) / 60_000) : top;
      const bottom = Math.min(DAY_MINUTES, Math.max(endMinutes, top + MIN_MINUTES));
      return { id: item.id, top: Math.min(top, DAY_MINUTES - MIN_MINUTES), bottom };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const blocks: Block[] = [];
  // Groups of items that overlap each other, laid out together.
  let group: { span: (typeof spans)[number]; column: number }[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...group.map((entry) => entry.column + 1));
    for (const { span, column } of group) {
      blocks.push({ id: span.id, top: span.top, height: span.bottom - span.top, column, columns });
    }
    group = [];
  };
  for (const span of spans) {
    if (group.length && span.top >= groupEnd) flush();
    // The first column whose last item has ended.
    let column = 0;
    while (group.some((entry) => entry.column === column && entry.span.bottom > span.top)) column++;
    group.push({ span, column });
    groupEnd = Math.max(groupEnd, span.bottom);
    if (group.length === 1) groupEnd = span.bottom;
  }
  if (group.length) flush();
  return blocks;
}

/** The seven days of `day`'s week, starting on `weekStartsOn` (0 = Sunday). */
export function weekDays(day: Date, weekStartsOn: number): Date[] {
  const start = startOfDay(day);
  const back = (start.getDay() - weekStartsOn + 7) % 7;
  const first = addDays(start, -back);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}
