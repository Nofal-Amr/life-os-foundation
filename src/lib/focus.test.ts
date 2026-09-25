import { describe, expect, it } from "vitest";

import { focusEndISO, focusMatches, focusRemaining } from "./focus";

const session = { startedAt: Date.parse("2026-09-25T10:00:00Z"), minutes: 25 };

describe("focus sessions", () => {
  it("counts down and stops at zero", () => {
    expect(focusRemaining(session, Date.parse("2026-09-25T10:10:00Z"))).toBe(15 * 60_000);
    expect(focusRemaining(session, Date.parse("2026-09-25T11:00:00Z"))).toBe(0);
  });

  it("ends exactly at the planned length", () => {
    expect(focusEndISO(session)).toBe("2026-09-25T10:25:00.000Z");
  });

  it("belongs only to the timer started with it", () => {
    expect(focusMatches(session, "2026-09-25T10:00:02Z")).toBe(true);
    expect(focusMatches(session, "2026-09-25T10:05:00Z")).toBe(false);
    expect(focusMatches(null, "2026-09-25T10:00:00Z")).toBe(false);
  });
});
