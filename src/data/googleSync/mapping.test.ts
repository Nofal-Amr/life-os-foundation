import { describe, expect, it } from "vitest";

import { dateInZone, googleToLife, lifeToGoogle, newestWins, zonedToIso } from "./mapping";

describe("time zones", () => {
  it("finds local midnight across a DST change", () => {
    // New York leaves DST on 2026-11-01.
    expect(zonedToIso("2026-10-31", 0, 0, "America/New_York")).toBe("2026-10-31T04:00:00.000Z");
    expect(zonedToIso("2026-11-02", 0, 0, "America/New_York")).toBe("2026-11-02T05:00:00.000Z");
  });
  it("reads the local date of an instant", () => {
    expect(dateInZone("2026-11-19T22:30:00.000Z", "Africa/Cairo")).toBe("2026-11-20");
  });
});

describe("googleToLife", () => {
  it("gives untitled events a calm placeholder and keeps empty descriptions empty", () => {
    const e = googleToLife(
      { id: "a", summary: "  ", description: "", start: { dateTime: "2026-11-14T09:00:00+02:00" } },
      "UTC",
    );
    expect(e).toEqual({
      title: "(No title)",
      description: null,
      start_at: "2026-11-14T07:00:00.000Z",
      end_at: null,
    });
  });
  it("treats a one-day all-day event as that whole day", () => {
    const e = googleToLife(
      { id: "a", start: { date: "2026-11-20" }, end: { date: "2026-11-21" } },
      "UTC",
    );
    expect(e.start_at).toBe("2026-11-20T00:00:00.000Z");
    expect(e.end_at).toBe("2026-11-20T23:59:00.000Z");
  });
});

describe("lifeToGoogle", () => {
  const row = { title: "T", description: null, start_at: "2026-11-14T09:00:00.000Z", end_at: null };
  it("adds a one-hour end when Life OS has none", () => {
    expect(lifeToGoogle(row, { allDay: false, timeZone: "UTC" }).end).toEqual({
      dateTime: "2026-11-14T10:00:00.000Z",
    });
  });
  it("sends all-day events as dates with an exclusive end", () => {
    const body = lifeToGoogle(
      { ...row, start_at: "2026-11-19T22:00:00.000Z", end_at: "2026-11-21T21:59:00.000Z" },
      { allDay: true, timeZone: "Africa/Cairo" },
    );
    expect(body.start).toEqual({ date: "2026-11-20" });
    expect(body.end).toEqual({ date: "2026-11-22" });
  });
});

describe("newestWins", () => {
  it("picks the later edit and gives ties to Google", () => {
    expect(newestWins("2026-11-13T10:00:01Z", "2026-11-13T10:00:00Z")).toBe("life");
    expect(newestWins("2026-11-13T10:00:00Z", "2026-11-13T10:00:01Z")).toBe("google");
    expect(newestWins("2026-11-13T10:00:00Z", "2026-11-13T10:00:00Z")).toBe("google");
  });
});
