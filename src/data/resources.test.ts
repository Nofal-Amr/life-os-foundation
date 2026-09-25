import { describe, expect, it } from "vitest";

import { cycleWindow, tierUsage, topUpPlan, type Resource, type ResourceReading } from "./resources";
import { EGYPT_RESIDENTIAL_2026 } from "./tariff";

function withCycle(extra: Partial<Resource>): Resource {
  return {
    cycle_start_date: null,
    cycle_days: null,
    cycle_unit: "days",
    cycle_count: 1,
    ...extra,
  } as unknown as Resource;
}

describe("cycleWindow", () => {
  it("keeps day-based cycles behaving as before", () => {
    const window = cycleWindow(
      withCycle({ cycle_start_date: "2026-01-01", cycle_days: 30, cycle_unit: "days" }),
      new Date("2026-01-15T12:00:00Z"),
    );
    expect(window).toEqual({ start: "2026-01-01", end: "2026-01-30" });
  });

  it("uses real calendar months", () => {
    const window = cycleWindow(
      withCycle({ cycle_start_date: "2026-01-10", cycle_unit: "months", cycle_count: 1 }),
      new Date("2026-03-05T12:00:00Z"),
    );
    expect(window).toEqual({ start: "2026-02-10", end: "2026-03-09" });
  });

  it("clamps a start day the target month does not have", () => {
    /* A cycle anchored on the 31st ends the day before 28 February. */
    expect(
      cycleWindow(
        withCycle({ cycle_start_date: "2026-01-31", cycle_unit: "months", cycle_count: 1 }),
        new Date("2026-02-15T12:00:00Z"),
      ),
    ).toEqual({ start: "2026-01-31", end: "2026-02-27" });

    expect(
      cycleWindow(
        withCycle({ cycle_start_date: "2026-01-31", cycle_unit: "months", cycle_count: 1 }),
        new Date("2026-03-01T12:00:00Z"),
      ),
    ).toEqual({ start: "2026-02-28", end: "2026-03-30" });
  });

  it("handles cycles longer than one month", () => {
    expect(
      cycleWindow(
        withCycle({ cycle_start_date: "2026-01-15", cycle_unit: "months", cycle_count: 3 }),
        new Date("2026-05-01T12:00:00Z"),
      ),
    ).toEqual({ start: "2026-04-15", end: "2026-07-14" });
  });

  it("returns nothing without a start date", () => {
    expect(cycleWindow(withCycle({ cycle_unit: "months", cycle_count: 1 }))).toBeNull();
  });
});

describe("tier usage for electricity", () => {
  const prepaid = {
    id: "e",
    kind: "quota",
    tariff: EGYPT_RESIDENTIAL_2026,
    cycle_start_date: null,
    cycle_days: null,
    cycle_unit: null,
    cycle_count: null,
  } as unknown as Resource;
  const reading = (value: number, at: string) =>
    ({ resource_id: "e", reading: value, reading_at: at }) as ResourceReading;
  const today = new Date("2026-09-21T12:00:00");

  it("adds up drops in a prepaid balance this month and ignores top-ups", () => {
    const usage = tierUsage(
      prepaid,
      [
        reading(500, "2026-08-30T10:00:00"), // last reading before September: the starting point
        reading(380, "2026-09-10T10:00:00"), // used 120
        reading(900, "2026-09-12T10:00:00"), // top-up
        reading(820, "2026-09-20T10:00:00"), // used 80
      ],
      undefined,
      today,
    )!;
    expect(usage.used).toBe(200);
    expect(usage.bill.tier).toBe(3);
    expect(usage.until).toEqual({ next: 4, kwh: 0 });
  });

  it("previews a reading before it's saved", () => {
    const usage = tierUsage(
      prepaid,
      [reading(500, "2026-09-01T10:00:00")],
      { reading: 260, at: "2026-09-21T10:00:00" },
      today,
    )!;
    expect(usage.used).toBe(240);
    expect(usage.bill.tier).toBe(4);
  });

  it("is null without a tariff", () => {
    expect(tierUsage({ ...prepaid, tariff: null } as Resource, [], undefined, today)).toBeNull();
  });
});

describe("quotaRate", () => {
  const r = (reading: number, at: string) => ({ reading, reading_at: at }) as never;
  it("averages every drop and skips top-ups", async () => {
    const { quotaRate } = await import("./resources");
    // 200 -> 150 (50 used), top-up to 300, -> 260 (40 used): 90 over 3 days.
    expect(
      quotaRate([
        r(200, "2026-09-18T08:00:00Z"),
        r(150, "2026-09-19T08:00:00Z"),
        r(300, "2026-09-20T08:00:00Z"),
        r(260, "2026-09-21T08:00:00Z"),
      ]),
    ).toBeCloseTo(30);
  });
  it("needs three readings over at least two days", async () => {
    const { quotaRate } = await import("./resources");
    expect(quotaRate([r(180, "2026-09-22T08:00:00Z"), r(150, "2026-09-22T12:00:00Z")])).toBeNull();
    // Three readings, but only one day apart.
    expect(
      quotaRate([
        r(200, "2026-09-21T08:00:00Z"),
        r(180, "2026-09-21T20:00:00Z"),
        r(150, "2026-09-22T08:00:00Z"),
      ]),
    ).toBeNull();
    expect(quotaRate([r(150, "2026-09-22T12:00:00Z")])).toBeNull();
  });
});

describe("topUpPlan", () => {
  it("adds what was credited and names the fee for a money balance", () => {
    expect(topUpPlan({ balance: 20, paid: 300, credited: 290, moneyUnit: true })).toEqual({
      credited: 290,
      balanceAfter: 310,
      fees: 10,
    });
  });

  it("pays back a negative balance first", () => {
    expect(topUpPlan({ balance: -50, paid: 300, credited: 290, moneyUnit: true }).balanceAfter).toBe(240);
  });

  it("works from the balance shown after the top-up", () => {
    expect(topUpPlan({ balance: -50, paid: 300, balanceAfter: 240, moneyUnit: true })).toEqual({
      credited: 290,
      balanceAfter: 240,
      fees: 10,
    });
  });

  it("has no fee when the balance isn't money (a data package)", () => {
    expect(topUpPlan({ balance: 2, paid: 300, credited: 140, moneyUnit: false }).fees).toBeNull();
  });
});
