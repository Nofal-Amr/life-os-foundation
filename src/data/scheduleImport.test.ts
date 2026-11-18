import { describe, expect, it } from "vitest";

import { clockOf, parseSchedule, weekdayOf } from "./scheduleImport";

describe("schedule from an AI answer or a photo", () => {
  it("reads the prompt's format, classes and exams", () => {
    const result = parseSchedule(
      [
        "```",
        "CLASS | Sunday | 09:00 | 10:30 | Calculus I | Room 204",
        "CLASS | Tuesday | 09:00 | 10:30 | Calculus I |",
        "CLASS | Monday | 13:00 | 14:30 | Physics | Lab 3",
        "EXAM | 2026-12-14 | 10:00 | Calculus I | Midterm",
        "```",
      ].join("\n"),
    );
    expect(result.slots).toEqual([
      { course: "Calculus I", weekday: 0, starts: "09:00", ends: "10:30", room: "Room 204" },
      { course: "Calculus I", weekday: 2, starts: "09:00", ends: "10:30", room: null },
      { course: "Physics", weekday: 1, starts: "13:00", ends: "14:30", room: "Lab 3" },
    ]);
    expect(result.exams).toHaveLength(1);
    expect(result.exams[0]!.title).toBe("Calculus I · Midterm");
    const due = new Date(result.exams[0]!.dueAt);
    expect([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()]).toEqual([
      2026, 11, 14, 10,
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("reads loose lines and weekday headings", () => {
    const result = parseSchedule(
      [
        "Mon 9:00 AM - 10:30 AM Calculus I (Room 204)",
        "Wednesday",
        "1:00pm to 2:30pm Physics Lab 3",
        "Lunch",
      ].join("\n"),
    );
    expect(result.slots).toEqual([
      { course: "Calculus I", weekday: 1, starts: "09:00", ends: "10:30", room: "Room 204" },
      { course: "Physics", weekday: 3, starts: "13:00", ends: "14:30", room: "Lab 3" },
    ]);
  });

  it("reads Arabic weekdays and times", () => {
    const result = parseSchedule("CLASS | الأحد | 9:00 ص | 1:00 م | تفاضل | قاعة 5");
    expect(result.slots[0]).toMatchObject({ weekday: 0, starts: "09:00", ends: "13:00" });
  });

  it("skips what it can't read and says so, and drops repeats", () => {
    const result = parseSchedule(
      [
        "CLASS | Someday | 09:00 | 10:30 | X |",
        "CLASS | Monday | 11:00 | 10:00 | Backwards |",
        "CLASS | Monday | 09:00 | 10:00 | Art |",
        "CLASS | Monday | 09:00 | 10:00 | art |",
      ].join("\n"),
    );
    expect(result.slots).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
  });

  it("weekday and clock helpers", () => {
    expect(weekdayOf("Thurs")).toBe(4);
    expect(weekdayOf("السبت")).toBe(6);
    expect(clockOf("12:15 PM")).toBe("12:15");
    expect(clockOf("12:15 AM")).toBe("00:15");
    expect(clockOf("25:00")).toBeNull();
  });
});
