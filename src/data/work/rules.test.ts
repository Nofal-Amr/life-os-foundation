import { describe, expect, it } from "vitest";

import { ADO_PRESET, ladderPenalty, monthSheet, type ClockEvent, type WorkRules } from "./rules";

/** A Cairo local time on a September 2026 day (Cairo is UTC+3 then). */
const cairo = (day: number, time: string) =>
  `2026-09-${String(day).padStart(2, "0")}T${time}:00+03:00`;

const pair = (day: number, inAt: string, outAt: string): ClockEvent[] => [
  { kind: "in", at: cairo(day, inAt) },
  { kind: "out", at: cairo(day, outAt) },
];

/** Amr's September 2026 sheet from ADO Consult, as clock events. */
const ADO_SEPTEMBER: ClockEvent[] = [
  ...pair(1, "08:04", "18:20"),
  ...pair(3, "07:58", "16:33"),
  ...pair(6, "09:59", "16:56"),
  ...pair(7, "08:14", "16:31"),
  ...pair(8, "09:20", "16:43"),
  ...pair(9, "08:03", "16:31"),
  ...pair(10, "08:24", "16:31"),
  ...pair(13, "08:03", "18:45"),
  ...pair(14, "08:25", "20:19"),
  ...pair(15, "08:09", "17:12"),
  ...pair(16, "08:21", "22:39"),
  ...pair(17, "09:21", "21:24"),
  // A Saturday worked (the sheet printed these times on the 20th's row).
  ...pair(19, "08:41", "14:47"),
  ...pair(22, "08:23", "16:31"),
  ...pair(23, "08:25", "16:32"),
  ...pair(24, "08:32", "16:31"),
  ...pair(27, "08:19", "16:31"),
  ...pair(28, "08:26", "16:37"),
  ...pair(29, "08:25", "16:40"),
  ...pair(30, "08:23", "16:43"),
];

const leaves = [
  { day: "2026-09-02", typeId: "with" },
  { day: "2026-09-20", typeId: "annual" },
  { day: "2026-09-21", typeId: "annual" },
];

const sheet = (events: ClockEvent[], extra: Partial<Parameters<typeof monthSheet>[0]> = {}) =>
  monthSheet({
    rules: ADO_PRESET,
    month: "2026-09",
    baseSalary: 9500,
    events,
    corrections: [],
    leaves: [],
    holidays: [],
    ...extra,
  });

const row = (result: ReturnType<typeof monthSheet>, day: number) =>
  result.rows.find((item) => item.day === `2026-09-${String(day).padStart(2, "0")}`)!;

describe("monthSheet", () => {
  it("reproduces the ADO September sheet", () => {
    const result = sheet(ADO_SEPTEMBER, { leaves });
    expect(result.totals.late).toBe(276);
    expect(result.totals.penalty).toBe(450);
    expect(result.totals.overtime).toBe(1627);
    expect(result.money.deductions).toBe(569);
    expect(result.money.overtimePay).toBe(1274);
    expect(result.money.leaveDeductions).toBe(475);
    expect(result.money.total).toBe(9730);
  });

  it("ladder counts occurrences in the month", () => {
    const result = sheet(ADO_SEPTEMBER, { leaves });
    expect([6, 8, 17].map((day) => row(result, day).penalty)).toEqual([120, 150, 180]);
    expect([6, 8, 17].map((day) => row(result, day).late)).toEqual([0, 0, 0]);
  });

  it("a ladder can end in a day's penalty and then start again", () => {
    const cycle = { minutes: [120, 150, 180], thenAdd: 30, afterLast: "day" as const };
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ladderPenalty(cycle, n))).toEqual([
      { minutes: 120, day: false },
      { minutes: 150, day: false },
      { minutes: 180, day: false },
      { minutes: 0, day: true },
      { minutes: 120, day: false },
      { minutes: 150, day: false },
      { minutes: 180, day: false },
      { minutes: 0, day: true },
      { minutes: 120, day: false },
    ]);
    // Saved rules without the choice keep adding minutes, as before.
    expect([4, 5].map((n) => ladderPenalty({ minutes: [120, 150, 180], thenAdd: 30 }, n))).toEqual([
      { minutes: 210, day: false },
      { minutes: 240, day: false },
    ]);
  });

  it("the fourth late arrival costs a day on the sheet, the fifth starts again", () => {
    const result = sheet([
      ...pair(1, "09:30", "16:30"),
      ...pair(2, "09:30", "16:30"),
      ...pair(3, "09:30", "16:30"),
      ...pair(6, "09:30", "16:30"),
      ...pair(7, "09:30", "16:30"),
    ]);
    expect(
      [1, 2, 3, 6, 7].map((day) => [row(result, day).penalty, row(result, day).dayPenalty]),
    ).toEqual([
      [120, false],
      [150, false],
      [180, false],
      [0, true],
      [120, false],
    ]);
  });

  it("a step's tolerance lets a clock-in just after its time through", () => {
    const rules: WorkRules = {
      ...ADO_PRESET,
      lateSteps: [
        {
          after: "08:30",
          tolerance: 2,
          penalty: { kind: "ladder", minutes: [120, 150, 180], thenAdd: 30, afterLast: "day" },
        },
      ],
    };
    const result = sheet([...pair(1, "08:32", "16:30"), ...pair(2, "08:33", "16:30")], { rules });
    // 08:32 is within the 2 minutes: no penalty, only the minutes late from 08:00.
    expect([row(result, 1).penalty, row(result, 1).late]).toEqual([0, 32]);
    // 08:33 is past it: the ladder's first rung.
    expect([row(result, 2).penalty, row(result, 2).late]).toEqual([120, 0]);
  });

  it("after 10:00 costs a day", () => {
    const result = sheet([
      ...pair(1, "09:30", "16:30"),
      ...pair(2, "10:05", "16:30"),
      ...pair(3, "09:15", "16:30"),
    ]);
    expect(row(result, 2).dayPenalty).toBe(true);
    expect(row(result, 2).penalty).toBe(0);
    // A day's penalty is 5% of base salary (÷ 20).
    expect(result.money.dayPenaltyDeductions).toBe(Math.round(9500 / 20));
    // The day penalty doesn't count as a ladder occurrence.
    expect(row(result, 3).penalty).toBe(150);
  });

  it("a day's penalty day counts as overtime from clock-in to clock-out", () => {
    const result = sheet([
      // After 10:00: 10:05 to 17:00 is all overtime, and leaving early isn't counted.
      ...pair(1, "10:05", "17:00"),
      ...pair(2, "10:20", "15:00"),
      // The ladder: 120, 150, 180, then the 4th time is a day, counted from 09:30.
      ...pair(3, "09:30", "16:30"),
      ...pair(6, "09:30", "16:30"),
      ...pair(7, "09:30", "16:30"),
      ...pair(8, "09:30", "18:00"),
    ]);
    expect([row(result, 1).overtime, row(result, 1).earlyLeave]).toEqual([415, 0]);
    expect([row(result, 2).overtime, row(result, 2).earlyLeave]).toEqual([280, 0]);
    expect([3, 6, 7].map((day) => row(result, day).overtime)).toEqual([0, 0, 0]);
    expect([row(result, 8).dayPenalty, row(result, 8).overtime]).toEqual([true, 510]);
    expect(result.totals.dayPenalties).toBe(3);
  });

  it("with the choice off, a day's penalty day counts only the usual overtime", () => {
    const rules: WorkRules = {
      ...ADO_PRESET,
      overtime: { ...ADO_PRESET.overtime, dayPenaltyAllOvertime: false },
    };
    const result = sheet(pair(1, "10:05", "17:00"), { rules });
    expect([row(result, 1).overtime, row(result, 1).earlyLeave]).toEqual([30, 0]);
  });

  it("the ADO ladder starts after 08:30, with 2 minutes' tolerance", () => {
    const result = sheet([...pair(1, "08:32", "16:30"), ...pair(2, "08:33", "16:30")]);
    expect([row(result, 1).penalty, row(result, 1).late]).toEqual([0, 32]);
    expect(row(result, 2).penalty).toBe(120);
  });

  it("belongs to the day it started", () => {
    const result = sheet([
      { kind: "in", at: cairo(14, "08:00") },
      { kind: "out", at: cairo(15, "01:30") },
    ]);
    expect(row(result, 14).overtime).toBe(540);
    expect(row(result, 15).in).toBeNull();
  });

  it("uses first in and last out", () => {
    const result = sheet([
      { kind: "in", at: cairo(15, "08:00") },
      { kind: "out", at: cairo(15, "12:00") },
      { kind: "in", at: cairo(15, "13:00") },
      { kind: "out", at: cairo(15, "17:00") },
    ]);
    expect(row(result, 15).in).toBe(cairo(15, "08:00"));
    expect(row(result, 15).out).toBe(cairo(15, "17:00"));
    expect(row(result, 15).overtime).toBe(30);
  });

  it("a correction replaces the time and is marked", () => {
    const result = sheet([{ kind: "in", at: cairo(16, "08:00") }], {
      corrections: [
        { day: "2026-09-16", field: "out", at: cairo(16, "16:30"), reason: "Forgot to clock out" },
      ],
    });
    expect(row(result, 16).out).toBe(cairo(16, "16:30"));
    expect(row(result, 16).corrected).toEqual(["out"]);
    expect(row(result, 16).note).toBeNull();
  });

  it("orders events by time, not arrival", () => {
    const shuffled = [...ADO_SEPTEMBER].reverse();
    expect(sheet(shuffled, { leaves })).toEqual(sheet(ADO_SEPTEMBER, { leaves }));
  });

  it("uses the salary rate when there is no fixed rate", () => {
    const rules: WorkRules = { ...ADO_PRESET, rate: { kind: "fromSalary" } };
    const result = sheet([], { rules });
    expect(result.money.ratePerHour).toBe(9500 / (22 * 8.5));
  });

  it("marks unexplained absence without deducting", () => {
    const result = sheet([]);
    expect(row(result, 1).note).toBe("absent-unexplained");
    expect(row(result, 4).note).toBeNull(); // a Friday
    expect(result.money.total).toBe(9500);
  });
});

describe("several taps in one day", () => {
  it("pays from the first clock-in to the last clock-out and lists the taps between", () => {
    const sheet = monthSheet({
      rules: ADO_PRESET,
      month: "2026-11",
      baseSalary: 6000,
      events: [
        { kind: "in", at: "2026-11-17T08:20:00+02:00" },
        { kind: "out", at: "2026-11-17T09:12:00+02:00" },
        { kind: "in", at: "2026-11-17T09:44:00+02:00" },
        { kind: "out", at: "2026-11-17T16:30:00+02:00" },
      ],
      corrections: [],
      leaves: [],
      holidays: [],
    });
    const row = sheet.rows.find((item) => item.day === "2026-11-17")!;
    expect(row.in).toBe("2026-11-17T08:20:00+02:00");
    expect(row.out).toBe("2026-11-17T16:30:00+02:00");
    expect(row.between.map((event) => event.kind)).toEqual(["out", "in"]);
    expect(row.earlyLeave).toBe(0);
  });
});
