import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { additionsFor, countsIn, isMonthly, previousMonth, type WorkPayItem } from "./payItems";

const item = (patch: Partial<WorkPayItem>): WorkPayItem => ({
  id: "1",
  org_id: "o",
  user_id: "u",
  kind: "allowance",
  label: "Transport allowance",
  amount: 300,
  from_month: "2026-10-01",
  until_month: null,
  created_at: "2026-10-01T00:00:00Z",
  ...patch,
});

describe("pay items", () => {
  it("a monthly item counts from its first month until it's stopped", () => {
    const monthly = item({});
    expect(countsIn(monthly, "2026-09")).toBe(false);
    expect(countsIn(monthly, "2026-10")).toBe(true);
    expect(countsIn(monthly, "2027-03")).toBe(true);
    const stopped = item({ until_month: "2026-11-01" });
    expect(countsIn(stopped, "2026-11")).toBe(true);
    expect(countsIn(stopped, "2026-12")).toBe(false);
    expect(isMonthly(monthly)).toBe(true);
  });

  it("a one-off counts in its month only", () => {
    const once = item({ kind: "incentive", from_month: "2026-11-01", until_month: "2026-11-01" });
    expect(isMonthly(once)).toBe(false);
    expect(countsIn(once, "2026-11")).toBe(true);
    expect(countsIn(once, "2026-12")).toBe(false);
  });

  it("gives one person's additions for a month, oldest first", () => {
    const items = [
      item({
        id: "a",
        label: "Incentive",
        amount: 500,
        created_at: "2026-11-05T00:00:00Z",
        from_month: "2026-11-01",
        until_month: "2026-11-01",
      }),
      item({ id: "b" }),
      item({ id: "c", user_id: "someone else" }),
    ];
    expect(additionsFor(items, "u", "2026-11")).toEqual([
      { label: "Transport allowance", amount: 300 },
      { label: "Incentive", amount: 500 },
    ]);
  });

  it("knows the month before, across a year", () => {
    expect(previousMonth("2026-11")).toBe("2026-10-01");
    expect(previousMonth("2027-01")).toBe("2026-12-01");
  });
});
