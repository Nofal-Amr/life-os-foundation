import { describe, expect, it } from "vitest";

import { ADO_PRESET, monthSheet, type ClockEvent } from "./rules";
import { exportSheets, sheetRows } from "./sheetExport";

const cairo = (day: number, time: string) =>
  `2026-09-${String(day).padStart(2, "0")}T${time}:00+03:00`;
const pair = (day: number, inAt: string, outAt: string): ClockEvent[] => [
  { kind: "in", at: cairo(day, inAt) },
  { kind: "out", at: cairo(day, outAt) },
];

// The same September as the rules test, condensed to the days that matter for totals.
const events: ClockEvent[] = [
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
  ...pair(19, "08:41", "14:47"),
  ...pair(22, "08:23", "16:31"),
  ...pair(23, "08:25", "16:32"),
  ...pair(24, "08:32", "16:31"),
  ...pair(27, "08:19", "16:31"),
  ...pair(28, "08:26", "16:37"),
  ...pair(29, "08:25", "16:40"),
  ...pair(30, "08:23", "16:43"),
];
const september = monthSheet({
  rules: ADO_PRESET,
  month: "2026-09",
  baseSalary: 9500,
  events,
  corrections: [],
  leaves: [
    { day: "2026-09-02", typeId: "with" },
    { day: "2026-09-20", typeId: "annual" },
    { day: "2026-09-21", typeId: "annual" },
  ],
  holidays: [],
});

const options = {
  labels: (text: string) => text,
  fmt: { time: (iso: string) => iso.slice(11, 16), date: (day: string) => day },
  leaveName: (id: string) => ADO_PRESET.leaveTypes.find((type) => type.id === id)?.name ?? id,
};

describe("sheetExport", () => {
  it("sheet rows follow the example's order", () => {
    const rows = sheetRows(september, options);
    expect(rows[0]).toEqual([
      "Date",
      "Day",
      "In",
      "Out",
      "Late (min)",
      "Penalty (min)",
      "Early leave (min)",
      "Overtime (min)",
    ]);
    const days = rows.slice(1, 31);
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual(["2026-09-01", "Tuesday", "08:04", "18:20", 4, 0, 0, 110]);
    expect(days[1]?.[2]).toBe("Leave with permission");
    const totals = rows.find((row) => row[0] === "Total (minutes)");
    expect(totals?.slice(4)).toEqual([276, 450, 0, 1627]);
    const money = Object.fromEntries(
      rows.filter((row) => row.length === 2).map((row) => [row[0], row[1]]),
    );
    expect(money["Late, penalties and early leave"]).toBe(-569);
    expect(money["Overtime pay"]).toBe(1274);
    expect(money["Leave deductions"]).toBe(-475);
    expect(money["Total"]).toBe(9730);
  });

  it("one worksheet per person", () => {
    const bytes = exportSheets(
      [
        { person: "Amr", sheet: september },
        { person: "Mona", sheet: september },
      ],
      "ADO Consult",
      "2026-09",
      options,
    );
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("xl/worksheets/sheet2.xml");
    expect(text).not.toContain("xl/worksheets/sheet3.xml");
    expect(text).toContain("ADO Consult");
  });
});
