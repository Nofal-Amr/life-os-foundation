import { queryOptions } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap, writeWithColumnFallback } from "@/lib/supabase-helpers";

type Enums = Database["public"]["Enums"];

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type FinanceCategory = Database["public"]["Tables"]["finance_categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type RecurringCost = Database["public"]["Tables"]["recurring_costs"]["Row"];
export type PaydayConfig = Database["public"]["Tables"]["payday_config"]["Row"];

export type AccountType = Enums["account_type"];
export type CategoryKind = Enums["category_kind"];
export type TransactionKind = Enums["transaction_kind"];
export type RecurrenceFrequency = Enums["recurrence_frequency"];
export type IntervalUnit = Exclude<Enums["interval_unit"], "hour">;
export type PaydaySchedule = Enums["payday_schedule"];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Current account" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
];

export const CATEGORY_KINDS: { value: CategoryKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export const TRANSACTION_KINDS: { value: TransactionKind; label: string }[] = [
  { value: "expense", label: "Money out" },
  { value: "income", label: "Money in" },
  { value: "adjustment", label: "Adjustment" },
];

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

/** Empty labels only — never any invented amounts or transactions. */
export const STARTER_CATEGORIES: { name: string; kind: CategoryKind }[] = [
  { name: "Groceries", kind: "expense" },
  { name: "Rent", kind: "expense" },
  { name: "Transport", kind: "expense" },
  { name: "Eating out", kind: "expense" },
  { name: "Utilities", kind: "expense" },
  { name: "Subscriptions", kind: "expense" },
  { name: "Health", kind: "expense" },
  { name: "Salary", kind: "income" },
];

export const financeKeys = {
  accounts: ["accounts"] as const,
  categories: ["finance_categories"] as const,
  transactions: ["transactions"] as const,
  recurring: ["recurring_costs"] as const,
  payday: ["payday_config"] as const,
  pockets: ["account_pockets"] as const,
};

/* ------------------------------- queries ------------------------------- */

export const accountsQuery = () =>
  queryOptions({
    queryKey: financeKeys.accounts,
    queryFn: async () =>
      unwrap(
        await supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      ) as Account[],
  });

export const financeCategoriesQuery = () =>
  queryOptions({
    queryKey: financeKeys.categories,
    queryFn: async () =>
      unwrap(
        await supabase.from("finance_categories").select("*").order("name", { ascending: true }),
      ) as FinanceCategory[],
  });

export const transactionsQuery = () =>
  queryOptions({
    queryKey: financeKeys.transactions,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as Transaction[],
  });

export const recurringCostsQuery = () =>
  queryOptions({
    queryKey: financeKeys.recurring,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("recurring_costs")
          .select("*")
          .order("next_due_date", { ascending: true }),
      ) as RecurringCost[],
  });

export const paydayConfigQuery = () =>
  queryOptions({
    queryKey: financeKeys.payday,
    queryFn: async () =>
      unwrap(await supabase.from("payday_config").select("*").maybeSingle()) as PaydayConfig | null,
  });

/* ------------------------------ accounts ------------------------------- */

export type AccountInput = {
  name: string;
  type: AccountType;
  opening_balance: number;
  currency: string | null;
  active: boolean;
  icon: string | null;
  color: string | null;
  /** False keeps the account tracked but out of "left to spend" (e.g. a home fund). */
  counts_toward_spendable: boolean;
};

export async function createAccount(input: AccountInput): Promise<Account> {
  const user_id = await currentUserId();
  const insert = (row: Partial<AccountInput>) =>
    supabase
      .from("accounts")
      .insert({ ...(row as AccountInput), user_id })
      .select()
      .single();
  let result = await insert(input);
  if (missingSpendableColumn(result.error)) result = await insert(withoutSpendableFlag(input));
  return unwrap(result) as Account;
}

export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<Account> {
  const update = (row: Partial<AccountInput>) =>
    supabase.from("accounts").update(row).eq("id", id).select().single();
  let result = await update(input);
  if (missingSpendableColumn(result.error)) result = await update(withoutSpendableFlag(input));
  return unwrap(result) as Account;
}

/**
 * Until migration 20260921130000 is applied the column doesn't exist; saving
 * still works, and every account keeps counting toward left to spend.
 */
function missingSpendableColumn(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error && error.code === "PGRST204" && !!error.message?.includes("counts_toward_spendable")
  );
}

function withoutSpendableFlag(input: Partial<AccountInput>): Partial<AccountInput> {
  const { counts_toward_spendable: _omit, ...rest } = input;
  return rest;
}

export async function deleteAccount(id: string): Promise<void> {
  unwrap(await supabase.from("accounts").delete().eq("id", id).select());
}

/* ----------------------------- categories ------------------------------ */

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  color: string | null;
  monthly_budget: number | null;
  icon: string | null;
};

export async function createCategory(input: CategoryInput): Promise<FinanceCategory> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("finance_categories")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as FinanceCategory;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<FinanceCategory> {
  return unwrap(
    await supabase.from("finance_categories").update(input).eq("id", id).select().single(),
  ) as FinanceCategory;
}

export async function deleteCategory(id: string): Promise<void> {
  unwrap(await supabase.from("finance_categories").delete().eq("id", id).select());
}

/** Creates the starter category labels only. No amounts, no transactions. */
export async function addStarterCategories(): Promise<FinanceCategory[]> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("finance_categories")
      .insert(
        STARTER_CATEGORIES.map((c) => ({
          ...c,
          icon: null,
          color: null,
          monthly_budget: null,
          user_id,
        })),
      )
      .select(),
  ) as FinanceCategory[];
}

/* ---------------------------- transactions ----------------------------- */

export type TransactionInput = {
  account_id: string;
  category_id: string | null;
  /** Signed: positive = money in, negative = money out. */
  amount: number;
  kind: TransactionKind;
  description: string | null;
  date: string;
  pocket_id?: string | null;
  /** Time of day, "HH:mm" (optional). */
  occurred_time?: string | null;
};

/** "HH:mm" now, for pre-filling the time of a new transaction. */
export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Newest first: by date, then time of day (entries without a time last). */
export function compareTransactions(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return (b.occurred_time ?? "").localeCompare(a.occurred_time ?? "");
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const user_id = await currentUserId();
  return unwrap(
    await writeWithColumnFallback({ ...input, user_id }, (row) =>
      supabase.from("transactions").insert(row).select().single(),
    ),
  ) as Transaction;
}

export async function updateTransaction(
  id: string,
  input: Partial<TransactionInput>,
): Promise<Transaction> {
  return unwrap(
    await writeWithColumnFallback(input, (row) =>
      supabase.from("transactions").update(row).eq("id", id).select().single(),
    ),
  ) as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  unwrap(await supabase.from("transactions").delete().eq("id", id).select());
}

/** Turn an entered magnitude plus a kind into the signed amount we store. */
export function signedAmount(magnitude: number, kind: TransactionKind): number {
  const value = Math.abs(magnitude);
  return kind === "expense" ? -value : value;
}

/* --------------------------- recurring costs --------------------------- */

export type RecurringCostInput = {
  name: string;
  /** Positive magnitude. */
  amount: number;
  category_id: string | null;
  account_id: string | null;
  frequency: RecurrenceFrequency;
  next_due_date: string;
  active: boolean;
  interval_count: number;
  interval_unit: IntervalUnit;
  next_due_at: string | null;
};

export async function createRecurringCost(input: RecurringCostInput): Promise<RecurringCost> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("recurring_costs")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as RecurringCost;
}

export async function updateRecurringCost(
  id: string,
  input: Partial<RecurringCostInput>,
): Promise<RecurringCost> {
  return unwrap(
    await supabase.from("recurring_costs").update(input).eq("id", id).select().single(),
  ) as RecurringCost;
}

export async function deleteRecurringCost(id: string): Promise<void> {
  unwrap(await supabase.from("recurring_costs").delete().eq("id", id).select());
}

export function legacyFrequency(unit: IntervalUnit, count: number): RecurrenceFrequency {
  if (count === 1 && unit === "day") return "daily";
  if (count === 1 && unit === "week") return "weekly";
  if (count === 1 && unit === "month") return "monthly";
  if (count === 1 && unit === "year") return "yearly";
  return "custom";
}

export function recurringInterval(cost: RecurringCost): { count: number; unit: IntervalUnit } {
  const count = Math.max(1, Number(cost.interval_count || 1));
  if (cost.interval_unit && cost.interval_unit !== "hour")
    return { count, unit: cost.interval_unit };
  if (cost.frequency === "daily") return { count: 1, unit: "day" };
  if (cost.frequency === "weekly") return { count: 1, unit: "week" };
  if (cost.frequency === "yearly") return { count: 1, unit: "year" };
  return { count: 1, unit: "month" };
}

export function advanceDate(date: string, count: number, unit: IntervalUnit): string {
  const current = parseISO(date);
  const next =
    unit === "day"
      ? addDays(current, count)
      : unit === "week"
        ? addWeeks(current, count)
        : unit === "year"
          ? addYears(current, count)
          : addMonths(current, count);
  return format(next, "yyyy-MM-dd");
}

/**
 * Logging a recurring cost is the only thing that touches a balance: it writes
 * a real signed transaction and rolls the due date forward.
 */
export async function logRecurringCost(cost: RecurringCost): Promise<void> {
  if (!cost.account_id) {
    throw new Error("Choose an account for this cost before logging it.");
  }
  await createTransaction({
    account_id: cost.account_id,
    category_id: cost.category_id,
    amount: -Math.abs(Number(cost.amount)),
    kind: "expense",
    description: cost.name,
    date: cost.next_due_date,
  });
  const interval = recurringInterval(cost);
  const next = advanceDate(cost.next_due_date, interval.count, interval.unit);
  await updateRecurringCost(cost.id, {
    next_due_date: next,
    next_due_at: `${next}T00:00:00`,
    frequency: legacyFrequency(interval.unit, interval.count),
  });
}

/** Skipping only moves the date — no transaction, no balance change. */
export async function skipRecurringCost(cost: RecurringCost): Promise<void> {
  const interval = recurringInterval(cost);
  const next = advanceDate(cost.next_due_date, interval.count, interval.unit);
  await updateRecurringCost(cost.id, {
    next_due_date: next,
    next_due_at: `${next}T00:00:00`,
    frequency: legacyFrequency(interval.unit, interval.count),
  });
}

/* ------------------------------- payday -------------------------------- */

export type PaydayInput = {
  schedule: PaydaySchedule;
  pay_day: number | null;
  interval_weeks: number | null;
  anchor_date: string | null;
  expected_net_amount: number | null;
  safety_buffer: number | null;
};

export async function savePaydayConfig(input: Partial<PaydayInput>): Promise<PaydayConfig> {
  const user_id = await currentUserId();
  const existing = unwrap(
    await supabase.from("payday_config").select("id").eq("user_id", user_id).maybeSingle(),
  ) as { id: string } | null;

  if (existing) {
    return unwrap(
      await supabase.from("payday_config").update(input).eq("id", existing.id).select().single(),
    ) as PaydayConfig;
  }
  return unwrap(
    await supabase
      .from("payday_config")
      .insert({ schedule: "monthly", ...input, user_id })
      .select()
      .single(),
  ) as PaydayConfig;
}

/** True only when the user has actually told us when they are paid. */
export function hasPaydaySetup(config: PaydayConfig | null | undefined): boolean {
  if (!config) return false;
  return config.schedule === "monthly"
    ? config.pay_day != null
    : config.anchor_date != null && config.interval_weeks != null;
}

/** The next payday on or after `from`, or null when nothing is configured. */
export function nextPayday(
  config: PaydayConfig | null | undefined,
  from: Date = new Date(),
): Date | null {
  if (!hasPaydaySetup(config) || !config) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (config.schedule === "monthly") {
    const day = config.pay_day as number;
    const inMonth = (base: Date) => {
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      return new Date(base.getFullYear(), base.getMonth(), Math.min(day, lastDay));
    };
    const thisMonth = inMonth(start);
    return thisMonth >= start ? thisMonth : inMonth(addMonths(start, 1));
  }

  const weeks = config.interval_weeks as number;
  let date = parseISO(config.anchor_date as string);
  if (weeks <= 0) return date >= start ? date : null;
  while (date < start) date = addDays(date, weeks * 7);
  return date;
}

/** The most recent payday on or before `from`, or null when nothing is set up. */
export function previousPayday(
  config: PaydayConfig | null | undefined,
  from: Date = new Date(),
): Date | null {
  if (!hasPaydaySetup(config) || !config) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (config.schedule === "monthly") {
    const day = config.pay_day as number;
    const inMonth = (base: Date) => {
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      return new Date(base.getFullYear(), base.getMonth(), Math.min(day, lastDay));
    };
    const thisMonth = inMonth(start);
    return thisMonth <= start ? thisMonth : inMonth(addMonths(start, -1));
  }

  const weeks = config.interval_weeks as number;
  if (weeks <= 0) return null;
  const next = nextPayday(config, from);
  if (!next) return null;
  const prev = addDays(next, -weeks * 7);
  return prev <= start ? prev : null;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(date, from);
}

/* ------------------------------ balances ------------------------------- */

export function accountBalance(
  account: Account,
  transactions: Transaction[],
  pockets: AccountPocket[] = [],
): number {
  const moved = transactions
    .filter((t) => t.account_id === account.id)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const pocketOpening = pockets
    .filter((p) => p.account_id === account.id)
    .reduce((sum, p) => sum + Number(p.opening_balance), 0);
  return Number(account.opening_balance) + pocketOpening + moved;
}

/** A pocket holds its own opening balance plus the transactions assigned to it. */
export function pocketBalance(pocket: AccountPocket, transactions: Transaction[]): number {
  const moved = transactions
    .filter((t) => t.pocket_id === pocket.id)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  return Number(pocket.opening_balance) + moved;
}

/** Whether an account's money counts toward "left to spend". */
export function countsTowardSpendable(account: Account): boolean {
  // Missing column (migration not applied yet) means the old behaviour: counts.
  return account.counts_toward_spendable !== false;
}

/** Spendable money: active, non-credit accounts that count toward left to spend. */
export function liquidBalance(
  accounts: Account[],
  transactions: Transaction[],
  pockets: AccountPocket[] = [],
): number {
  return accounts
    .filter((a) => a.active && a.type !== "credit" && countsTowardSpendable(a))
    .reduce((sum, a) => sum + accountBalance(a, transactions, pockets), 0);
}

/** Money tracked in accounts kept separate from left to spend (e.g. a home fund). */
export function separateBalance(
  accounts: Account[],
  transactions: Transaction[],
  pockets: AccountPocket[] = [],
): number {
  return accounts
    .filter((a) => a.active && a.type !== "credit" && !countsTowardSpendable(a))
    .reduce((sum, a) => sum + accountBalance(a, transactions, pockets), 0);
}

/** Active recurring costs falling due on or before the given date. */
export function upcomingCostsBefore(costs: RecurringCost[], before: Date | null): RecurringCost[] {
  if (!before) return [];
  return costs
    .filter((c) => c.active && parseISO(c.next_due_date) <= before)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

export function committedBefore(costs: RecurringCost[], before: Date | null): number {
  return upcomingCostsBefore(costs, before).reduce((sum, c) => sum + Math.abs(Number(c.amount)), 0);
}

export function availableBeforePayday(args: {
  accounts: Account[];
  transactions: Transaction[];
  costs: RecurringCost[];
  payday: Date | null;
  safetyBuffer: number | null;
  pockets?: AccountPocket[];
}): {
  liquid: number;
  committed: number;
  buffer: number;
  available: number;
  upcoming: RecurringCost[];
} {
  const liquid = liquidBalance(args.accounts, args.transactions, args.pockets ?? []);
  const upcoming = upcomingCostsBefore(args.costs, args.payday);
  const committed = upcoming.reduce((sum, c) => sum + Math.abs(Number(c.amount)), 0);
  const buffer = Number(args.safetyBuffer ?? 0);
  return { liquid, committed, buffer, available: liquid - committed - buffer, upcoming };
}

/* ------------------------------- pockets ------------------------------- */

export type AccountPocket = Database["public"]["Tables"]["account_pockets"]["Row"];

export const POCKET_KINDS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash in hand" },
  { value: "debit", label: "Debit / bank" },
  { value: "savings", label: "Savings" },
];

export function pocketKindLabel(kind: string): string {
  return POCKET_KINDS.find((option) => option.value === kind)?.label ?? kind;
}

export const accountPocketsQuery = () =>
  queryOptions({
    queryKey: financeKeys.pockets,
    queryFn: async () =>
      unwrap(
        await supabase.from("account_pockets").select("*").order("created_at", { ascending: true }),
      ) as AccountPocket[],
  });

export type PocketInput = {
  account_id: string;
  name: string;
  kind: string;
  opening_balance: number;
};

export async function createPocket(input: PocketInput): Promise<AccountPocket> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("account_pockets")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as AccountPocket;
}

export async function updatePocket(
  id: string,
  input: Partial<PocketInput>,
): Promise<AccountPocket> {
  return unwrap(
    await supabase.from("account_pockets").update(input).eq("id", id).select().single(),
  ) as AccountPocket;
}

export async function deletePocket(id: string): Promise<void> {
  unwrap(await supabase.from("account_pockets").delete().eq("id", id).select());
}
