import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
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
});
