import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  allowanceUsed,
  nextClockKind,
  usesAllowance,
  todayClock,
  readRules,
  sheetInputFor,
  type WorkCorrection,
  type WorkEvent,
  type WorkLeave,
  type WorkMember,
} from "./api";
import { ADO_PRESET } from "./rules";

const member = { base_salary: 9500, overtime_rate: null } as WorkMember;
const event = (kind: WorkEvent["kind"], at: string) =>
  ({ kind, at, place_kind: "office" }) as WorkEvent;

describe("work api helpers", () => {
  it("readRules fills missing fields from the preset", () => {
    const rules = readRules({ dayStart: "09:00", graceMinutes: 5 });
    expect(rules.dayStart).toBe("09:00");
    expect(rules.graceMinutes).toBe(5);
    expect(rules.dayEnd).toBe(ADO_PRESET.dayEnd);
    expect(rules.leaveTypes).toEqual(ADO_PRESET.leaveTypes);
    expect(readRules(null)).toEqual(ADO_PRESET);
  });

  it("keeps a day's penalty day counted as before for rules saved without the choice", () => {
    expect(readRules({ overtime: { beforeStart: true } }).overtime.dayPenaltyAllOvertime).toBe(
      false,
    );
    expect(readRules({ dayStart: "08:00" }).overtime.dayPenaltyAllOvertime).toBe(true);
    expect(
      readRules({ overtime: { dayPenaltyAllOvertime: true } }).overtime.dayPenaltyAllOvertime,
    ).toBe(true);
  });

  it("keeps test options off for every company until one turns them on", () => {
    expect(readRules({ dayStart: "09:00" }).tests).toEqual({
      whatsappImport: false,
      whatsappPost: false,
    });
    expect(readRules({ tests: { whatsappPost: true } }).tests).toEqual({
      whatsappImport: false,
      whatsappPost: true,
    });
  });

  it("attempts never reach the sheet", () => {
    const input = sheetInputFor({
      member,
      rules: ADO_PRESET,
      month: "2026-10",
      events: [
        event("attempt", "2026-10-05T08:00:00+03:00"),
        event("in", "2026-10-05T08:10:00+03:00"),
      ],
      corrections: [],
      leaves: [],
      holidays: [],
    });
    expect(input.events).toEqual([
      { kind: "in", at: "2026-10-05T08:10:00+03:00", placeKind: "office" },
    ]);
    expect(input.baseSalary).toBe(9500);
  });

  it("a leave correction becomes a leave, and only approved leave counts", () => {
    const input = sheetInputFor({
      member,
      rules: ADO_PRESET,
      month: "2026-10",
      events: [],
      corrections: [
        { day: "2026-10-06", field: "leave", value: "with", reason: "Sick" } as WorkCorrection,
        {
          day: "2026-10-07",
          field: "out",
          value: "2026-10-07T16:30:00+03:00",
          reason: "Forgot",
        } as WorkCorrection,
      ],
      leaves: [
        { day: "2026-10-08", type_id: "annual", status: "approved" } as WorkLeave,
        { day: "2026-10-09", type_id: "annual", status: "requested" } as WorkLeave,
      ],
      holidays: [],
    });
    expect(input.leaves).toEqual([
      { day: "2026-10-08", typeId: "annual" },
      { day: "2026-10-06", typeId: "with" },
    ]);
    expect(input.corrections).toEqual([
      { day: "2026-10-07", field: "out", at: "2026-10-07T16:30:00+03:00", reason: "Forgot" },
    ]);
  });
  it("offers clock-out after midnight when the clock-in was last night", () => {
    const now = Date.parse("2026-10-06T01:30:00+03:00");
    expect(nextClockKind([event("in", "2026-10-05T20:00:00+03:00")], now)).toBe("out");
    expect(
      nextClockKind(
        [event("in", "2026-10-05T08:00:00+03:00"), event("out", "2026-10-05T16:30:00+03:00")],
        now,
      ),
    ).toBe("in");
    // A clock-in older than a day was a forgotten clock-out: start fresh.
    expect(nextClockKind([event("in", "2026-10-04T08:00:00+03:00")], now)).toBe("in");
    // Attempts don't count.
    expect(nextClockKind([event("attempt", "2026-10-06T01:00:00+03:00")], now)).toBe("in");
  });
});

describe("todayClock", () => {
  const day = "2026-11-17";
  const now = Date.parse("2026-11-17T09:39:00+02:00");
  const events = [
    { kind: "in", at: "2026-11-17T08:27:00+02:00" },
    { kind: "out", at: "2026-11-17T09:12:00+02:00" },
  ];

  it("shows the raw times and offers clock-in after a clock-out", () => {
    const today = todayClock({ day, events, corrections: [], recent: events, now });
    expect(today).toMatchObject({ out: "2026-11-17T09:12:00+02:00", corrected: [], next: "in" });
  });

  it("shows an admin's corrected clock-out and still offers clock-out before it", () => {
    const corrections = [{ day, field: "out", value: "2026-11-17T16:30:00+02:00" }];
    const today = todayClock({ day, events, corrections, recent: events, now });
    expect(today.out).toBe("2026-11-17T16:30:00+02:00");
    expect(today.corrected).toEqual(["out"]);
    expect(today.next).toBe("out");
  });

  it("offers clock-out again when a wrong clock-out was removed", () => {
    const corrections = [{ day, field: "out", value: null }];
    const today = todayClock({ day, events, corrections, recent: events, now });
    expect(today.out).toBeNull();
    expect(today.next).toBe("out");
  });

  it("ignores other days' corrections and falls back without a clock-in", () => {
    const corrections = [{ day: "2026-11-16", field: "out", value: null }];
    expect(todayClock({ day, events, corrections, recent: events, now }).next).toBe("in");
    const lastNight = [{ kind: "in", at: "2026-11-16T22:00:00+02:00" }];
    expect(todayClock({ day, events: [], corrections: [], recent: lastNight, now }).next).toBe(
      "out",
    );
  });
});

describe("official holidays", () => {
  it("default to none and reach the sheet from the rules", () => {
    expect(readRules({}).holidays).toEqual([]);
    const rules = readRules({ holidays: [{ day: "2026-11-03", name: "Test" }] });
    const input = sheetInputFor({
      member: { base_salary: 6000, overtime_rate: null },
      rules,
      month: "2026-11",
      events: [],
      corrections: [],
      leaves: [],
      holidays: [],
      today: "2026-11-17",
    });
    expect(input.holidays).toEqual(["2026-11-03"]);
    expect(input.today).toBe("2026-11-17");
  });
});

describe("paid vacation days used", () => {
  const rules = {
    leaveTypes: [
      { id: "annual", name: "Annual leave", percent: 0 },
      { id: "with", name: "With permission", percent: 5 },
      { id: "sick", name: "Sick", percent: 0, fromAllowance: true },
    ],
  };
  it("counts approved allowance leave and admin leave marks, one per day", () => {
    const used = allowanceUsed({
      userId: "u",
      rules,
      leaves: [
        { user_id: "u", day: "2026-11-01", type_id: "annual", status: "approved" },
        { user_id: "u", day: "2026-11-02", type_id: "annual", status: "requested" },
        { user_id: "u", day: "2026-11-03", type_id: "with", status: "approved" },
        { user_id: "x", day: "2026-11-04", type_id: "annual", status: "approved" },
      ],
      corrections: [
        { user_id: "u", day: "2026-11-01", field: "leave", value: "annual" },
        { user_id: "u", day: "2026-11-05", field: "leave", value: "sick" },
        { user_id: "u", day: "2026-11-03", field: "leave", value: "annual" },
        { user_id: "u", day: "2026-11-06", field: "out", value: null },
      ],
    });
    // 1 Nov (once), 3 Nov (changed to annual), 5 Nov (sick uses the allowance).
    expect(used).toBe(3);
  });
  it("knows which kinds use the allowance", () => {
    expect(usesAllowance({ id: "annual" })).toBe(true);
    expect(usesAllowance({ id: "with" })).toBe(false);
    expect(usesAllowance({ id: "annual", fromAllowance: false })).toBe(false);
    expect(usesAllowance(undefined)).toBe(false);
  });
});
