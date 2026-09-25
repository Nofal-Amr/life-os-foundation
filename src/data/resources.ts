import { queryOptions } from "@tanstack/react-query";
import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentUserId, unwrap, writeWithColumnFallback } from "@/lib/supabase-helpers";
import { billFor, parseTariff, untilNextTier, type Bill, type Tariff } from "./tariff";

export type Resource = Database["public"]["Tables"]["resources"]["Row"];
export type ResourceReading = Database["public"]["Tables"]["resource_readings"]["Row"];
export type ResourceKind = Database["public"]["Enums"]["resource_kind"];

export const RESOURCE_KINDS: { value: ResourceKind; label: string; hint: string }[] = [
  { value: "meter", label: "Meter", hint: "Readings go up, like an electricity meter." },
  { value: "quota", label: "Quota", hint: "Readings are what is left, like internet data." },
  {
    value: "vehicle",
    label: "Vehicle",
    hint: "Fill-ups and odometer: your real km per litre, cost per km and km left.",
  },
];

export const resourceKeys = {
  all: ["resources"] as const,
  readings: ["resource_readings"] as const,
};

export const resourcesQuery = () =>
  queryOptions({
    queryKey: resourceKeys.all,
    queryFn: async () =>
      unwrap(
        await supabase.from("resources").select("*").order("created_at", { ascending: true }),
      ) as Resource[],
  });

export const resourceReadingsQuery = () =>
  queryOptions({
    queryKey: resourceKeys.readings,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("resource_readings")
          .select("*")
          .order("reading_at", { ascending: true }),
      ) as ResourceReading[],
  });

export type ResourceInput = {
  name: string;
  kind: ResourceKind;
  unit: string;
  unit_cost: number | null;
  category_id: string | null;
  account_id: string | null;
  quota_amount: number | null;
  cycle_start_date: string | null;
  cycle_days: number | null;
  cycle_unit?: "days" | "months";
  cycle_count?: number;
  icon: string | null;
  color: string | null;
  active: boolean;
  /** Tiered pricing; when set it replaces unit_cost for bills. */
  tariff?: Tariff | null;
  /** Vehicles: "a full tank lasts about … km", until fill-ups say. */
  full_tank_km?: number | null;
};

export async function createResource(input: ResourceInput): Promise<Resource> {
  const user_id = await currentUserId();
  return unwrap(
    await writeWithColumnFallback({ ...input, user_id } as Record<string, unknown>, (row) =>
      supabase
        .from("resources")
        .insert(row as Database["public"]["Tables"]["resources"]["Insert"])
        .select()
        .single(),
    ),
  ) as Resource;
}

export async function updateResource(id: string, input: Partial<ResourceInput>): Promise<Resource> {
  return unwrap(
    await writeWithColumnFallback(input as Record<string, unknown>, (row) =>
      supabase
        .from("resources")
        .update(row as Database["public"]["Tables"]["resources"]["Update"])
        .eq("id", id)
        .select()
        .single(),
    ),
  ) as Resource;
}

export async function deleteResource(id: string): Promise<void> {
  unwrap(await supabase.from("resources").delete().eq("id", id).select());
}

export type ReadingInput = {
  resource_id: string;
  reading: number;
  reading_at: string;
  note: string | null;
};

export async function addReading(input: ReadingInput): Promise<ResourceReading> {
  const user_id = await currentUserId();
  return unwrap(
    await supabase
      .from("resource_readings")
      .insert({ ...input, user_id })
      .select()
      .single(),
  ) as ResourceReading;
}

/** Fix a reading: its value, when it was taken, or its note. */
export async function updateReading(
  id: string,
  input: Partial<Pick<ReadingInput, "reading" | "reading_at" | "note">>,
): Promise<ResourceReading> {
  return unwrap(
    await supabase.from("resource_readings").update(input).eq("id", id).select().single(),
  ) as ResourceReading;
}

export async function deleteReading(id: string): Promise<void> {
  unwrap(await supabase.from("resource_readings").delete().eq("id", id).select());
}

/* ----------------------------- derived facts ----------------------------- */

export function readingsFor(resource: Resource, readings: ResourceReading[]): ResourceReading[] {
  return readings
    .filter((r) => r.resource_id === resource.id)
    .sort((a, b) => a.reading_at.localeCompare(b.reading_at));
}

function daysBetween(a: string, b: string): number {
  const diff = Math.abs((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export type MeterFacts = {
  kind: "meter";
  latest: ResourceReading;
  previous: ResourceReading | null;
  /** Consumption between the two most recent readings. */
  lastConsumption: number | null;
  lastCost: number | null;
  perDay: number | null;
  cycleConsumption: number | null;
  cycleCost: number | null;
  projectedCycleCost: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  /** With a tariff: this cycle's tier and bill, and the projected ones. */
  tier: {
    tariff: Tariff;
    current: Bill | null;
    until: { next: number; kwh: number } | null;
    projected: Bill | null;
  } | null;
};

export type QuotaFacts = {
  kind: "quota";
  latest: ResourceReading;
  previous: ResourceReading | null;
  remaining: number;
  perDay: number | null;
  daysLeft: number | null;
  runsOutOn: string | null;
  cycleEnd: string | null;
  runsOutBeforeCycleEnd: boolean | null;
  /**
   * Below zero, e.g. a prepaid meter on emergency credit or after a tier
   * change: this much is paid back first from the next top-up.
   */
  owed: number;
  /** With a tariff (e.g. a prepaid electricity meter): usage this month and its tier. */
  tier: TierUsage | null;
};

export type TierUsage = {
  tariff: Tariff;
  /** Usage so far in the billing period, in the resource's unit. */
  used: number;
  bill: Bill;
  until: { next: number; kwh: number } | null;
  periodStart: string;
};

/**
 * Usage in the current billing period (the resource's cycle, else the
 * calendar month), for tiered pricing. A running-total meter uses last minus
 * first; a prepaid balance adds up each drop and ignores top-ups (rises).
 * `pending` lets the reading dialog preview a reading before it's saved.
 */
export function tierUsage(
  resource: Resource,
  readings: ResourceReading[],
  pending?: { reading: number; at: string },
  today = new Date(),
): TierUsage | null {
  const tariff = parseTariff(resource.tariff);
  if (!tariff) return null;
  const periodStart = cycleWindow(resource, today)?.start ?? format(today, "yyyy-MM-01");
  const list = [
    ...readingsFor(resource, readings),
    ...(pending ? [{ reading: pending.reading, reading_at: pending.at } as ResourceReading] : []),
  ].sort((a, b) => a.reading_at.localeCompare(b.reading_at));
  // The last reading before the period counts as its starting point.
  const before = list.filter((r) => r.reading_at.slice(0, 10) < periodStart).at(-1);
  const inPeriod = list.filter((r) => r.reading_at.slice(0, 10) >= periodStart);
  const series = before ? [before, ...inPeriod] : inPeriod;
  let used = 0;
  if (resource.kind === "meter") {
    if (series.length > 1) used = Number(series.at(-1)!.reading) - Number(series[0]!.reading);
  } else {
    for (let i = 1; i < series.length; i++) {
      const drop = Number(series[i - 1]!.reading) - Number(series[i]!.reading);
      if (drop > 0) used += drop;
    }
  }
  used = Math.max(0, used);
  return {
    tariff,
    used,
    bill: billFor(tariff, used),
    until: untilNextTier(tariff, used),
    periodStart,
  };
}

/**
 * The cycle the given day falls in. Months are real calendar months: a start
 * day that does not exist in the target month clamps to that month's last day.
 * Resources stored in days keep behaving exactly as before.
 */
export function cycleWindow(
  resource: Resource,
  today = new Date(),
): { start: string; end: string } | null {
  if (!resource.cycle_start_date) return null;
  const anchor = parseISO(resource.cycle_start_date);

  if (resource.cycle_unit === "months") {
    const count = Number(resource.cycle_count ?? 0);
    if (count <= 0) return null;
    let periods = 0;
    /* Walk forward whole cycles until the next one starts after today. */
    while (differenceInCalendarDays(today, addMonths(anchor, (periods + 1) * count)) >= 0) {
      periods += 1;
      if (periods > 1200) break;
    }
    const start = addMonths(anchor, periods * count);
    const end = addDays(addMonths(anchor, (periods + 1) * count), -1);
    return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
  }

  if (!resource.cycle_days || resource.cycle_days <= 0) return null;
  let start = anchor;
  const length = Number(resource.cycle_days);
  while (differenceInCalendarDays(today, start) >= length) start = addDays(start, length);
  const end = addDays(start, length - 1);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

/** Real length of the current cycle in days, from its own start and end. */
export function cycleLengthDays(resource: Resource, today = new Date()): number | null {
  const window = cycleWindow(resource, today);
  if (!window) return null;
  return differenceInCalendarDays(parseISO(window.end), parseISO(window.start)) + 1;
}

/** Never guesses: returns null whenever fewer than two readings exist. */
export function meterFacts(
  resource: Resource,
  readings: ResourceReading[],
  today = new Date(),
): MeterFacts | null {
  const list = readingsFor(resource, readings);
  const latest = list[list.length - 1];
  if (!latest) return null;
  const previous = list.length > 1 ? (list[list.length - 2] as ResourceReading) : null;
  const tariff = parseTariff(resource.tariff);
  // A tiered bill can't be split per reading, so flat prices only apply without a tariff.
  const unitCost = tariff || resource.unit_cost == null ? null : Number(resource.unit_cost);

  let lastConsumption: number | null = null;
  let perDay: number | null = null;
  if (previous) {
    lastConsumption = Number(latest.reading) - Number(previous.reading);
    const days = daysBetween(previous.reading_at, latest.reading_at);
    perDay = days > 0 ? lastConsumption / days : null;
  }

  const window = cycleWindow(resource, today);
  let cycleConsumption: number | null = null;
  let projectedCycleCost: number | null = null;
  let projectedConsumption: number | null = null;
  if (window) {
    const inCycle = list.filter((r) => r.reading_at.slice(0, 10) >= window.start);
    const first = inCycle[0];
    if (first && inCycle.length > 1) {
      const last = inCycle[inCycle.length - 1] as ResourceReading;
      cycleConsumption = Number(last.reading) - Number(first.reading);
      const elapsed = daysBetween(first.reading_at, last.reading_at);
      const rate = elapsed > 0 ? cycleConsumption / elapsed : null;
      const cycleLength = Number(cycleLengthDays(resource, today) ?? 0);
      if (rate != null && cycleLength > 0) projectedConsumption = rate * cycleLength;
      if (projectedConsumption != null && unitCost != null) {
        projectedCycleCost = projectedConsumption * unitCost;
      }
    }
  }

  return {
    kind: "meter",
    latest,
    previous,
    lastConsumption,
    lastCost: lastConsumption != null && unitCost != null ? lastConsumption * unitCost : null,
    perDay,
    cycleConsumption,
    cycleCost: tariff
      ? cycleConsumption != null
        ? billFor(tariff, cycleConsumption).total
        : null
      : cycleConsumption != null && unitCost != null
        ? cycleConsumption * unitCost
        : null,
    projectedCycleCost:
      tariff && projectedConsumption != null
        ? billFor(tariff, projectedConsumption).total
        : projectedCycleCost,
    cycleStart: window?.start ?? null,
    cycleEnd: window?.end ?? null,
    tier: tariff
      ? {
          tariff,
          current: cycleConsumption != null ? billFor(tariff, cycleConsumption) : null,
          until: cycleConsumption != null ? untilNextTier(tariff, cycleConsumption) : null,
          projected: projectedConsumption != null ? billFor(tariff, projectedConsumption) : null,
        }
      : null,
  };
}

/**
 * Average use per day of a balance (prepaid meter, data), from every drop
 * between readings in the last 30 days. Rises are top-ups and are skipped.
 * Needs readings at least a day apart, so two readings an hour apart can't
 * produce a wild rate. Null when there isn't enough to say.
 */
export function quotaRate(sorted: ResourceReading[], windowDays = 30): number | null {
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const from = new Date(latest.reading_at).getTime() - windowDays * 86_400_000;
  const recent = sorted.filter((r) => new Date(r.reading_at).getTime() >= from);
  // Three readings over at least two days, so a couple of entries minutes
  // apart can never imply a wild daily rate.
  if (recent.length < 3) return null;
  let used = 0;
  for (let i = 1; i < recent.length; i++) {
    const drop = Number(recent[i - 1]!.reading) - Number(recent[i]!.reading);
    if (drop > 0) used += drop;
  }
  const days = daysBetween(recent[0]!.reading_at, latest.reading_at);
  return days >= 2 && used > 0 ? used / days : null;
}

export function quotaFacts(
  resource: Resource,
  readings: ResourceReading[],
  today = new Date(),
): QuotaFacts | null {
  const list = readingsFor(resource, readings);
  const latest = list[list.length - 1];
  if (!latest) return null;
  const previous = list.length > 1 ? (list[list.length - 2] as ResourceReading) : null;

  const perDay = quotaRate(list);

  const remaining = Number(latest.reading);
  // An empty or negative balance has no days left to count down.
  const daysLeft = remaining <= 0 ? 0 : perDay && perDay > 0 ? remaining / perDay : null;
  const runsOutOn =
    daysLeft == null ? null : format(addDays(new Date(latest.reading_at), daysLeft), "yyyy-MM-dd");
  const window = cycleWindow(resource, today);

  return {
    kind: "quota",
    latest,
    previous,
    remaining,
    perDay,
    daysLeft,
    runsOutOn,
    cycleEnd: window?.end ?? null,
    runsOutBeforeCycleEnd: runsOutOn && window ? runsOutOn < window.end : null,
    owed: remaining < 0 ? -remaining : 0,
    tier: tierUsage(resource, readings, undefined, today),
  };
}

/** Units that are money, so paid minus credited is a fee. */
const MONEY_UNITS = ["egp", "le", "l.e.", "ج", "جنيه", "usd", "$", "eur", "€", "sar", "aed"];

export function isMoneyUnit(unit: string, currency?: string | null): boolean {
  const value = unit.trim().toLowerCase();
  return MONEY_UNITS.includes(value) || (!!currency && value === currency.trim().toLowerCase());
}

/**
 * A top-up: what you paid and what the balance gained. Give either the
 * amount credited or the balance shown afterwards; the other follows. When
 * the balance is money, paid minus credited is the fee.
 */
export function topUpPlan(args: {
  balance: number | null;
  paid: number;
  credited?: number | null;
  balanceAfter?: number | null;
  moneyUnit: boolean;
}): { credited: number | null; balanceAfter: number | null; fees: number | null } {
  const { balance, paid } = args;
  let credited = args.credited ?? null;
  let balanceAfter = args.balanceAfter ?? null;
  if (credited == null && balanceAfter != null && balance != null) credited = balanceAfter - balance;
  if (balanceAfter == null && credited != null) balanceAfter = (balance ?? 0) + credited;
  const fees =
    args.moneyUnit && credited != null ? Math.round((paid - credited) * 100) / 100 : null;
  return { credited, balanceAfter, fees };
}
