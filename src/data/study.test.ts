import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  classesOn,
  courseAverage,
  dueLabel,
  parseIcs,
  type ClassSession,
  type StudyItem,
} from "./study";

const ics = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Calculus II",
  "DTSTART;TZID=Africa/Cairo:20261004T100000",
  "DTEND;TZID=Africa/Cairo:20261004T113000",
  "RRULE:FREQ=WEEKLY;BYDAY=SU,TU",
  "LOCATION:Hall B\\, room 3",
  "END:VEVENT",
  // The same lab listed twice, no RRULE: still a weekly slot.
  "BEGIN:VEVENT",
  "SUMMARY:Physics Lab",
  "DTSTART:20261005T130000",
  "DTEND:20261005T150000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Physics Lab",
  "DTSTART:20261012T130000",
  "DTEND:20261012T150000",
  "END:VEVENT",
  // A one-off: an exam.
  "BEGIN:VEVENT",
  "SUMMARY:Calculus II Midterm",
  "DTSTART:20991101T090000",
  "END:VEVENT",
  // A one-off that isn't an exam: skipped.
  "BEGIN:VEVENT",
  "SUMMARY:Career fair",
  "DTSTART:20991102T090000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  it("turns repeating classes into slots and one-off exams into exams", () => {
    const { slots, exams } = parseIcs(ics);
    expect(slots).toEqual([
      { course: "Calculus II", weekday: 0, starts: "10:00", ends: "11:30", room: "Hall B, room 3" },
      { course: "Calculus II", weekday: 2, starts: "10:00", ends: "11:30", room: "Hall B, room 3" },
      { course: "Physics Lab", weekday: 1, starts: "13:00", ends: "15:00", room: null },
    ]);
    expect(exams.map((exam) => exam.title)).toEqual(["Calculus II Midterm"]);
  });
});

describe("study helpers", () => {
  it("lists a day's classes in order", () => {
    const sessions = [
      { weekday: 4, starts: "12:00:00" },
      { weekday: 4, starts: "08:30:00" },
      { weekday: 1, starts: "09:00:00" },
    ] as ClassSession[];
    // 8 Oct 2026 is a Thursday.
    expect(classesOn(sessions, "2026-10-08").map((s) => s.starts)).toEqual([
      "08:30:00",
      "12:00:00",
    ]);
  });

  it("says when things are due", () => {
    const today = new Date(2026, 9, 8, 9);
    expect(dueLabel(new Date(2026, 9, 8, 23).toISOString(), today)).toBe("today");
    expect(dueLabel(new Date(2026, 9, 11, 9).toISOString(), today)).toBe("in 3 days");
  });

  it("averages grades, weighted when every item has a weight", () => {
    const items = [
      { course_id: "c", grade: 18, max_grade: 20, weight: 20 },
      { course_id: "c", grade: 30, max_grade: 60, weight: 80 },
      { course_id: "c", grade: null, max_grade: 100, weight: 10 },
    ] as StudyItem[];
    expect(courseAverage(items, "c")).toEqual({ percent: 58, graded: 2 });
    expect(courseAverage(items, "other")).toBeNull();
  });
});
