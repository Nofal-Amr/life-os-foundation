/**
 * Money an admin adds to someone's pay: an incentive, a transport allowance,
 * or anything else. Once (one month) or every month until stopped. The table
 * comes from supabase/migrations/20261117150000_work_pay_items.sql; until
 * that is applied the database answers "table not found", which
 * `isMissingTable` recognises so the page can say so calmly.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase-helpers";

import { isMissingTable } from "../relationshipsApi";

export type PayItemKind = "incentive" | "allowance" | "other";

export type WorkPayItem = {
  id: string;
  org_id: string;
  user_id: string;
  kind: PayItemKind;
  label: string;
  amount: number;
  /** The first month it counts, "yyyy-MM-01". */
  from_month: string;
  /** The last month it counts; null keeps going every month. */
  until_month: string | null;
  created_at: string;
};

export type PayItemInput = Pick<
  WorkPayItem,
  "org_id" | "user_id" | "kind" | "label" | "amount" | "from_month" | "until_month"
>;

// The generated types don't have this table until the migration is applied.
const table = () => supabase.from("work_pay_items" as never);

/** "2026-11" → "2026-11-01". */
export const monthStart = (month: string) => `${month.slice(0, 7)}-01`;

/** The month before, as "yyyy-MM-01". */
export function previousMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, number! - 2, 1));
  return date.toISOString().slice(0, 10);
}

/** Whether an item counts in a month ("yyyy-MM"). */
export function countsIn(item: Pick<WorkPayItem, "from_month" | "until_month">, month: string) {
  const start = monthStart(month);
  return (
    item.from_month.slice(0, 10) <= start &&
    (!item.until_month || item.until_month.slice(0, 10) >= start)
  );
}

/** Whether it repeats every month (rather than once). */
export const isMonthly = (item: Pick<WorkPayItem, "from_month" | "until_month">) =>
  item.until_month === null || item.until_month.slice(0, 10) !== item.from_month.slice(0, 10);

/** One person's items for a month, as the pay engine's additions. */
export function additionsFor(items: WorkPayItem[], userId: string, month: string) {
  return items
    .filter((item) => item.user_id === userId && countsIn(item, month))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((item) => ({ label: item.label, amount: Number(item.amount) }));
}

export const payItemsKey = (orgId: string) => ["work", "pay-items", orgId] as const;

/** Every item RLS lets you see in a company: yours, or everyone's for admins. */
export const workPayItemsQuery = (orgId: string) =>
  queryOptions({
    queryKey: payItemsKey(orgId),
    queryFn: async () =>
      unwrap(
        await table().select("*").eq("org_id", orgId).order("created_at"),
      ) as unknown as WorkPayItem[],
    retry: (count, error) => !isMissingTable(error) && count < 2,
  });

export async function addPayItems(inputs: PayItemInput[]): Promise<void> {
  if (!inputs.length) return;
  unwrap(
    await table()
      .insert(inputs as never)
      .select(),
  );
}

/**
 * Stop an item from a month on. If it would then count in no month at all
 * (it starts this month), it is removed instead.
 */
export async function stopPayItem(item: WorkPayItem, month: string): Promise<void> {
  if (item.from_month.slice(0, 10) >= monthStart(month)) {
    unwrap(await table().delete().eq("id", item.id).select());
    return;
  }
  unwrap(
    await table()
      .update({ until_month: previousMonth(month) } as never)
      .eq("id", item.id)
      .select(),
  );
}
