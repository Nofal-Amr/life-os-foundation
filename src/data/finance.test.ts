import { describe, expect, it } from "vitest";

import {
  advanceDate,
  availableBeforePayday,
  countsTowardSpendable,
  legacyFrequency,
  liquidBalance,
  monthlyEquivalent,
  recurringInterval,
  separateBalance,
  upcomingCostsBefore,
  type Account,
  type RecurringCost,
  type Transaction,
} from "./finance";

describe("recurring intervals", () => {
  it("advances custom daily and weekly intervals", () => {
    expect(advanceDate("2026-09-19", 5, "day")).toBe("2026-09-24");
    expect(advanceDate("2026-09-19", 3, "week")).toBe("2026-10-10");
  });

  it("keeps legacy frequency fields meaningful", () => {
    expect(legacyFrequency("month", 1)).toBe("monthly");
    expect(legacyFrequency("week", 3)).toBe("custom");
  });

  it("falls back to a legacy row when interval fields are absent", () => {
    const cost = { frequency: "weekly", interval_count: 1, interval_unit: null } as RecurringCost;
    expect(recurringInterval(cost)).toEqual({ count: 1, unit: "week" });
  });
});
describe("recurring costs before payday", () => {
  const cost = (fields: Partial<RecurringCost>) =>
    ({ id: fields.name, active: true, interval_count: 1, frequency: "custom", ...fields }) as RecurringCost;
  const costs = [
    cost({ name: "Transport", amount: 600, next_due_date: "2026-10-11", interval_unit: "week" }),
    cost({ name: "Pills", amount: 300, next_due_date: "2026-10-08", interval_unit: "day", interval_count: 15 }),
    cost({ name: "Internet", amount: 560, next_due_date: "2026-10-14", interval_unit: "month" }),
    cost({ name: "Later", amount: 99, next_due_date: "2026-11-20", interval_unit: "month" }),
    cost({ name: "Paused", amount: 50, next_due_date: "2026-10-09", interval_unit: "month", active: false }),
  ];
  const payday = new Date(2026, 10, 5);

  it("counts every time a cost comes round before payday", () => {
    const upcoming = upcomingCostsBefore(costs, payday);
    expect(upcoming.map((item) => [item.cost.name, item.dates.length, item.total])).toEqual([
      ["Pills", 2, 600],
      ["Transport", 4, 2400],
      ["Internet", 1, 560],
    ]);
  });

  it("takes them, and the buffer, off what you have", () => {
    const account = { id: "a", active: true, type: "checking", opening_balance: 8000 } as Account;
    const totals = availableBeforePayday({
      accounts: [account],
      transactions: [],
      costs,
      payday,
      safetyBuffer: 1000,
    });
    expect(totals.committed).toBe(3560);
    expect(totals.available).toBe(8000 - 3560 - 1000);
  });

  it("is nothing without a payday", () => {
    expect(upcomingCostsBefore(costs, null)).toEqual([]);
  });
});

describe("accounts kept separate from left to spend", () => {
  const account = (id: string, opening: number, extra: Partial<Account> = {}) =>
    ({ id, opening_balance: opening, active: true, type: "checking", ...extra }) as Account;
  const spend = { account_id: "self", amount: -200, pocket_id: null } as Transaction;

  it("leaves a separate account out of the spendable balance but still totals it", () => {
    const accounts = [
      account("self", 1000),
      account("home", 5000, { counts_toward_spendable: false }),
    ];
    expect(liquidBalance(accounts, [spend])).toBe(800);
    expect(separateBalance(accounts, [spend])).toBe(5000);
  });

  it("treats accounts from before the flag existed as counting", () => {
    const legacy = account("self", 1000);
    delete (legacy as Partial<Account>).counts_toward_spendable;
    expect(countsTowardSpendable(legacy)).toBe(true);
    expect(liquidBalance([legacy], [])).toBe(1000);
  });
});

describe("monthlyEquivalent", () => {
  const cost = (over: Record<string, unknown>) =>
    ({ active: true, amount: 100, frequency: "monthly", interval_count: 1, interval_unit: "month", ...over }) as never;

  it("turns any schedule into an average month", () => {
    expect(monthlyEquivalent(cost({}))).toBeCloseTo(100);
    expect(monthlyEquivalent(cost({ interval_unit: "year", amount: 1200 }))).toBeCloseTo(100);
    expect(monthlyEquivalent(cost({ interval_unit: "week" }))).toBeCloseTo(434.82, 1);
    expect(monthlyEquivalent(cost({ interval_unit: "month", interval_count: 3, amount: 300 }))).toBeCloseTo(100);
  });

  it("counts inactive costs as nothing", () => {
    expect(monthlyEquivalent(cost({ active: false }))).toBe(0);
  });
});
