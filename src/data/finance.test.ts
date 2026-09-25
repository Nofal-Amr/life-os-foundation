import { describe, expect, it } from "vitest";

import {
  advanceDate,
  countsTowardSpendable,
  legacyFrequency,
  liquidBalance,
  monthlyEquivalent,
  recurringInterval,
  separateBalance,
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
