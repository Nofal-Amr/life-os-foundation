import { describe, expect, it } from "vitest";

import { isDrop, sheetInputFor, tapCorrection, todayClock } from "./api";
import { ADO_PRESET, DROP_PREFIX, dayTaps, monthSheet } from "./rules";

/**
 * The 17 November 2026 day as it was stored: in 8:27, a wrong clock-out at
 * 9:12, back in at 9:44, out at 4:00 (Cairo), with the admin's corrections.
 */
const events = [
  { kind: "in", at: "2026-11-17T06:27:58.149+00:00", place_kind: null },
  { kind: "out", at: "2026-11-17T07:12:17.826+00:00", place_kind: null },
  { kind: "in", at: "2026-11-17T07:44:51.763+00:00", place_kind: null },
  { kind: "out", at: "2026-11-17T14:00:49.687+00:00", place_kind: null },
];
const corr = (field: string, value: string | null) => ({
  day: "2026-11-17",
  field,
  value,
  reason: ".",
});
const stored = [
  corr("out", "2026-11-17T14:30:00.000Z"),
  corr("in", null),
  corr("in", null),
  corr("in", "2026-11-17T06:26:00.000Z"),
  corr("out", null),
  corr("out", "2026-11-17T14:00:00.000Z"),
  corr("in", "2026-11-17T06:26:00.000Z"),
  corr("in", null),
  corr("in", "2026-11-17T06:26:00.000Z"),
];

const rowFor = (corrections: ReturnType<typeof corr>[]) =>
  monthSheet(
    sheetInputFor({
      member: { base_salary: 6000, overtime_rate: null },
      rules: ADO_PRESET,
      month: "2026-11",
      events,
      corrections,
      leaves: [],
      holidays: [],
      today: "2026-11-18",
    }),
  ).rows.find((row) => row.day === "2026-11-17")!;

describe("removing one wrong tap", () => {
  it("reads a drop correction", () => {
    const item = { field: "out", value: `${DROP_PREFIX}2026-11-17T07:12:17.826+00:00` };
    expect(isDrop(item)).toBe(true);
    expect(tapCorrection(item)).toEqual({
      field: "out",
      at: "2026-11-17T07:12:17.826+00:00",
      drop: true,
    });
    expect(isDrop({ value: "2026-11-17T14:00:00.000Z" })).toBe(false);
    expect(tapCorrection({ field: "in", value: null })).toEqual({ field: "in", at: null });
  });

  it("the stored day still shows the 9:12 / 9:44 break before the fix", () => {
    const row = rowFor(stored);
    expect(row.between.map((tap) => tap.kind)).toEqual(["out", "in"]);
  });

  it("dropping the wrong 9:12 clock-out joins the day into one stretch", () => {
    const row = rowFor([...stored, corr("out", `${DROP_PREFIX}${events[1]!.at}`)]);
    expect(row.between).toEqual([]);
    expect(row.in).toBe("2026-11-17T06:26:00.000Z");
    expect(row.out).toBe("2026-11-17T14:00:00.000Z");
    expect(row.corrected).toEqual(["out", "in"]);
  });

  it("a drop doesn't move the day's anchors", () => {
    const at = (clock: string) => `2026-11-17T${clock}:00+02:00`;
    const taps = [
      { kind: "in" as const, at: at("08:00") },
      { kind: "out" as const, at: at("12:00") },
      { kind: "in" as const, at: at("13:00") },
      { kind: "out" as const, at: at("16:30") },
    ];
    const result = dayTaps(taps, [{ field: "in", at: at("13:00"), drop: true }]);
    expect([result.in, result.out, result.corrected]).toEqual([at("08:00"), at("16:30"), []]);
    // 12:00 out then 16:30 out: the later one stays, so the day reads 8:00 to 16:30.
    expect(result.between).toEqual([]);
  });

  it("the clock card counts the same drop", () => {
    const now = Date.parse("2026-11-17T09:00:00Z");
    const today = todayClock({
      day: "2026-11-17",
      events: events.slice(0, 3),
      corrections: [corr("out", `${DROP_PREFIX}${events[1]!.at}`)],
      recent: events.slice(0, 3),
      now,
    });
    expect(today.taps.map((tap) => tap.kind)).toEqual(["in"]);
    expect(today.next).toBe("out");
  });
});
