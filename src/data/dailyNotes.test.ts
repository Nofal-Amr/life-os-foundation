import { describe, expect, it } from "vitest";

import {
  dailyDateOf,
  dailyNoteId,
  dailyNoteOn,
  dailyTag,
  dailyTitle,
  isDailyNote,
  isISODate,
  searchDailyNotes,
  shiftDay,
  uuidV5,
} from "@/data/dailyNotes";

const note = (tags: string[], body = "", updated_at = "2026-11-13T10:00:00Z") => ({
  tags,
  body,
  updated_at,
});

describe("daily notes", () => {
  it("tags and reads a day", () => {
    expect(dailyTag("2026-11-13")).toBe("daily:2026-11-13");
    expect(dailyDateOf(note(["work", "daily:2026-11-13"]))).toBe("2026-11-13");
    expect(isDailyNote(note(["idea"]))).toBe(false);
    expect(isDailyNote(note(["daily:2026-13-40"]))).toBe(false);
    expect(isDailyNote(note(["daily:"]))).toBe(false);
  });

  it("checks real dates only", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("13/11/2026")).toBe(false);
  });

  it("titles a day with its date", () => {
    expect(dailyTitle("2026-11-13")).toBe("Friday, 13 November 2026");
  });

  it("steps across months and years", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the day's note, newest if there are two", () => {
    const a = note(["daily:2026-11-13"], "a", "2026-11-13T08:00:00Z");
    const b = note(["daily:2026-11-13"], "b", "2026-11-13T09:00:00Z");
    expect(dailyNoteOn([a, b, note(["daily:2026-11-12"])], "2026-11-13")).toBe(b);
    expect(dailyNoteOn([a], "2026-11-14")).toBeNull();
  });

  it("searches daily notes only, newest day first, with a snippet", () => {
    const results = searchDailyNotes(
      [
        note(["daily:2026-11-10"], "Called the bank about the card"),
        note(["daily:2026-11-12"], "Bank visit went fine"),
        note(["idea"], "bank idea that is not a daily note"),
      ],
      "bank",
    );
    expect(results.map((r) => r.date)).toEqual(["2026-11-12", "2026-11-10"]);
    expect(results[1]?.snippet).toContain("bank");
    expect(searchDailyNotes([note(["daily:2026-11-12"], "x")], "  ")).toEqual([]);
  });

  it("makes standard version-5 UUIDs", async () => {
    // The RFC 4122 DNS namespace example.
    expect(await uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("gives every device the same id for the same day", async () => {
    const one = await dailyNoteId("user-1", "2026-11-13");
    expect(await dailyNoteId("user-1", "2026-11-13")).toBe(one);
    expect(await dailyNoteId("user-1", "2026-11-14")).not.toBe(one);
    expect(await dailyNoteId("user-2", "2026-11-13")).not.toBe(one);
    expect(one).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
