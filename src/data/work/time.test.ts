import { describe, expect, it } from "vitest";

import { zonedIso } from "./time";

describe("zonedIso", () => {
  it("reads a local time in the company's time zone", () => {
    // Cairo is UTC+3 in September 2026 (summer time) and UTC+2 in January.
    expect(zonedIso("2026-09-16", "16:30", "Africa/Cairo")).toBe("2026-09-16T13:30:00.000Z");
    expect(zonedIso("2026-01-15", "08:00", "Africa/Cairo")).toBe("2026-01-15T06:00:00.000Z");
  });

  it("works for zones behind UTC", () => {
    expect(zonedIso("2026-07-01", "09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
  });
});
