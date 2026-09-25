/**
 * Usage of a resource per day or per month, from its readings.
 *
 * Each gap between two readings is spread evenly over the time it covers, so
 * readings taken every few days still give a fair daily figure. A meter's use
 * is the rise between readings (a fall is a reset and is skipped); a balance
 * (prepaid meter, data) is used by its drops (a rise is a top-up and is
 * skipped). A day or month no pair of readings covers is null, not zero:
 * there is simply no reading for it.
 */
import { addDays, addMonths, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

export type UsagePeriod = "day" | "month";
export type UsageBucket = { key: string; start: Date; value: number | null };

type Reading = { reading: number | string; reading_at: string };

export function usageBuckets(
  kind: "meter" | "quota",
  readings: Reading[],
  period: UsagePeriod,
  today = new Date(),
  count = period === "day" ? 30 : 12,
): UsageBucket[] {
  const keyOf = (date: Date) => format(date, period === "day" ? "yyyy-MM-dd" : "yyyy-MM");
  const last = period === "day" ? startOfDay(today) : startOfMonth(today);
  const buckets: UsageBucket[] = Array.from({ length: count }, (_, index) => {
    const start =
      period === "day" ? subDays(last, count - 1 - index) : subMonths(last, count - 1 - index);
    return { key: keyOf(start), start, value: null };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  const sorted = [...readings].sort((a, b) => a.reading_at.localeCompare(b.reading_at));
  for (let index = 1; index < sorted.length; index++) {
    const before = sorted[index - 1]!;
    const after = sorted[index]!;
    const from = new Date(before.reading_at).getTime();
    const to = new Date(after.reading_at).getTime();
    if (!(to > from)) continue;
    const change = Number(after.reading) - Number(before.reading);
    const used = kind === "meter" ? Math.max(0, change) : Math.max(0, -change);
    const skipped = kind === "meter" ? change < 0 : change > 0;

    // Walk the calendar days (or months) the gap overlaps.
    let cursor = period === "day" ? startOfDay(new Date(from)) : startOfMonth(new Date(from));
    while (cursor.getTime() < to) {
      const next = period === "day" ? addDays(cursor, 1) : addMonths(cursor, 1);
      const overlap = Math.min(to, next.getTime()) - Math.max(from, cursor.getTime());
      const bucket = byKey.get(keyOf(cursor));
      if (bucket && overlap > 0) {
        // A reset or top-up still counts as covered, just with nothing used.
        bucket.value = (bucket.value ?? 0) + (skipped ? 0 : (used * overlap) / (to - from));
      }
      cursor = next;
    }
  }
  return buckets;
}
