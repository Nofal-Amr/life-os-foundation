import { describe, expect, it } from "vitest";

import { cycleWindow, type Resource } from "./resources";

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
