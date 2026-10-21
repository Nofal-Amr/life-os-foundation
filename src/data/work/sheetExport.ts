/**
 * The monthly sheet as rows (for Excel), laid out like the example sheet:
 * one row per day, then the minutes, the counts and the money.
 */
import { buildXlsx, type Cell } from "@/lib/xlsx";

import type { DayRow, MonthSheet } from "./rules";

export type SheetOptions = {
  /** Translate a label (the app's t()). */
  labels: (text: string) => string;
  fmt: { time: (iso: string) => string; date: (day: string) => string };
  leaveName: (typeId: string) => string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayCells(row: DayRow, { labels, fmt, leaveName }: SheetOptions): Cell[] {
  const date = fmt.date(row.day);
  const weekday = labels(WEEKDAYS[row.weekday]!);
  if (row.kind === "leave")
    return [date, weekday, leaveName(row.leaveTypeId ?? ""), "", "", "", "", ""];
  if (!row.in) {
    const what =
      row.note === "absent-unexplained"
        ? labels("Absent, not explained")
        : row.kind === "holiday"
          ? labels("Holiday")
          : labels("Day off");
    return [date, weekday, what, "", "", "", "", ""];
  }
  const mark = (field: "in" | "out") => (row.corrected.includes(field) ? " *" : "");
  return [
    date,
    weekday,
    fmt.time(row.in) + mark("in"),
    row.out ? fmt.time(row.out) + mark("out") : labels("No clock-out"),
    row.late,
    row.dayPenalty ? labels("A day") : row.penalty,
    row.earlyLeave,
    row.overtime,
  ];
}

export function sheetRows(sheet: MonthSheet, options: SheetOptions): Cell[][] {
  const { labels, leaveName } = options;
  const { totals, money } = sheet;
  const rows: Cell[][] = [
    [
      "Date",
      "Day",
      "In",
      "Out",
      "Late (min)",
      "Penalty (min)",
      "Early leave (min)",
      "Overtime (min)",
    ].map(labels),
    ...sheet.rows.map((row) => dayCells(row, options)),
    [],
    [
      labels("Total (minutes)"),
      "",
      "",
      "",
      totals.late,
      totals.penalty,
      totals.earlyLeave,
      totals.overtime,
    ],
    [
      labels("Late, penalty and early-leave time (hours)"),
      Math.round(((totals.late + totals.penalty + totals.earlyLeave) / 60) * 100) / 100,
    ],
    [labels("Overtime (hours)"), Math.round((totals.overtime / 60) * 100) / 100],
    ...Object.entries(totals.leaves).map(([typeId, days]): Cell[] => [
      `${leaveName(typeId)} (${labels("days")})`,
      days,
    ]),
    [labels("Day penalties (days)"), totals.dayPenalties],
    [labels("Site days"), totals.siteDays],
    [],
    [labels("Base salary"), money.base],
    [labels("Late, penalties and early leave"), -money.deductions],
    [labels("Overtime pay"), money.overtimePay],
    [labels("Leave deductions"), -money.leaveDeductions],
    [labels("Day penalties"), -money.dayPenaltyDeductions],
    [labels("Total"), money.total],
  ];
  if (sheet.rows.some((row) => row.corrected.length))
    rows.push([], [labels("* corrected by an admin")]);
  return rows;
}

/** One worksheet per person, titled with the company and the month. */
export function exportSheets(
  sheets: { person: string; sheet: MonthSheet }[],
  company: string,
  month: string,
  options: SheetOptions,
): Uint8Array {
  return buildXlsx(
    sheets.map(({ person, sheet }) => ({
      name: person,
      rows: [[company], [`${person} · ${month}`], [], ...sheetRows(sheet, options)],
    })),
  );
}
