/**
 * What going to work costs: logged spending in the categories you choose
 * (fuel, transport, food out…) on your workdays, over the last N days.
 * Only real transactions count; recurring costs that weren't logged don't.
 */
import { format, subDays } from "date-fns";

import type { Transaction } from "./finance";

export type WorkdayCost = {
  total: number;
  workdays: number;
  /** total ÷ workdays in the period (whether or not anything was spent that day). */
  perWorkday: number | null;
  /** Spending in those categories on days off, for comparison. */
  offDays: number;
  entries: number;
};

/** workdays: day numbers 0 (Sunday) … 6 (Saturday). */
export function workdayCost(args: {
  transactions: Transaction[];
  categoryIds: string[];
  workdays: number[];
  days?: number;
  today?: Date;
}): WorkdayCost {
  const period = args.days ?? 30;
  const today = args.today ?? new Date();
  const first = format(subDays(today, period - 1), "yyyy-MM-dd");
  const last = format(today, "yyyy-MM-dd");
  const categories = new Set(args.categoryIds);
  const workdays = new Set(args.workdays);

  let count = 0;
  for (let offset = 0; offset < period; offset++) {
    if (workdays.has(subDays(today, offset).getDay())) count += 1;
  }

  let total = 0;
  let offDays = 0;
  let entries = 0;
  for (const transaction of args.transactions) {
    if (transaction.kind !== "expense" || !transaction.category_id) continue;
    if (!categories.has(transaction.category_id)) continue;
    if (transaction.date < first || transaction.date > last) continue;
    const day = new Date(`${transaction.date}T12:00:00`).getDay();
    const value = Math.abs(Number(transaction.amount));
    if (workdays.has(day)) {
      total += value;
      entries += 1;
    } else {
      offDays += value;
    }
  }
  return { total, workdays: count, perWorkday: count ? total / count : null, offDays, entries };
}
