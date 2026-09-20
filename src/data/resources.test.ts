import { describe, expect, it } from "vitest";

import { cycleWindow, type Resource } from "./resources";

function resource(extra: Partial<Resource>): Resource {
  return {
    cycle_start_date: null,
    cycle_days: null,
    cycle_unit: "days",
    cycle_count: 1,
  } as unknown as Resource;
}

function withCycle(extra: Partial<Resource>): Resource {
  return { ...resource({}), ...extra } as Resource;
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

  it("clamps a start day that the target month does not have", () => {
    const window = cycleWindow(
      withCycle({ cycle_start_date: "2026-01-31", cycle_unit: "months", cycle_count: 1 }),
      new Date("2026-02-15T12:00:00Z"),
    );
    expect(window).toEqual({ start: "2026-02-28", end: "2026-03-30" });
  });

  it("returns nothing without a start date", () => {
    expect(cycleWindow(withCycle({ cycle_unit: "months", cycle_count: 1 }))).toBeNull();
  });
});
