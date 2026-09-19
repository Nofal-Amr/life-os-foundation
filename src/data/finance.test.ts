import { describe, expect, it } from "vitest";

import { advanceDate, legacyFrequency, recurringInterval, type RecurringCost } from "./finance";

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