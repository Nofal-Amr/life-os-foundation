/**
 * The work side's rules engine: clock events, leave and corrections in, the
 * month's attendance and pay sheet out. It is the only place pay is worked
 * out. Every number comes from the company's rules — HR makes them; the ADO
 * sheet is one ready-made preset, and nothing here assumes its numbers.
 */

export type LeaveType = { id: string; name: string; percent: number };

/** Arriving after `after` ("HH:mm") gives a penalty instead of late minutes. */
export type LateStep = {
  after: string;
  penalty: { kind: "ladder"; minutes: number[]; thenAdd: number } | { kind: "day" };
};

export type WorkRules = {
  timezone: string;
  currency: string;
  /** Days of the week that are work days, 0 = Sunday. */
  workDays: number[];
  dayStart: string;
  dayEnd: string;
  graceMinutes: number;
  lateSteps: LateStep[];
  overtime: {
    beforeStart: boolean;
    afterEnd: boolean;
    /** A day off that was worked counts entirely as overtime. */
    dayOffAllOvertime: boolean;
    minimumMinutes: number;
  };
  /** Per hour, for overtime pay and for late / penalty / early-leave deductions. */
  rate: { kind: "fixed"; perHour: number } | { kind: "fromSalary" };
  earlyLeaveCounted: boolean;
  leaveTypes: LeaveType[];
  /** A day's penalty costs base salary ÷ this. */
  dayPenaltyDivisor: number;
  /** Whether leave deductions come off the month's total. */
  absenceFromTotal: boolean;
  outsideRadius: "refuse" | "refuseAndRecord" | "allowWithReason";
};

/** The example sheet from ADO Consult, as a starting point HR can change. */
export const ADO_PRESET: WorkRules = {
  timezone: "Africa/Cairo",
  currency: "EGP",
  workDays: [0, 1, 2, 3, 4],
  dayStart: "08:00",
  dayEnd: "16:30",
  graceMinutes: 0,
  lateSteps: [
    { after: "09:00", penalty: { kind: "ladder", minutes: [120, 150, 180], thenAdd: 30 } },
    { after: "10:00", penalty: { kind: "day" } },
  ],
  overtime: { beforeStart: true, afterEnd: true, dayOffAllOvertime: true, minimumMinutes: 0 },
  rate: { kind: "fixed", perHour: 47 },
  earlyLeaveCounted: true,
  leaveTypes: [
    { id: "with", name: "Leave with permission", percent: 5 },
    { id: "without", name: "Leave without permission", percent: 7 },
    { id: "annual", name: "Annual leave", percent: 0 },
  ],
  dayPenaltyDivisor: 30,
  absenceFromTotal: true,
  outsideRadius: "refuseAndRecord",
};

export type ClockEvent = { kind: "in" | "out"; at: string; placeKind?: "office" | "site" };
/** An admin's change to a day's time; `at: null` removes it. */
export type Correction = { day: string; field: "in" | "out"; at: string | null; reason: string };
export type Leave = { day: string; typeId: string };

export type DayRow = {
  day: string;
  weekday: number;
  kind: "work" | "off" | "leave" | "holiday";
  in: string | null;
  out: string | null;
  late: number;
  penalty: number;
  dayPenalty: boolean;
  earlyLeave: number;
  overtime: number;
  site: boolean;
  corrected: ("in" | "out")[];
  note: "no-clock-out" | "absent-unexplained" | null;
  leaveTypeId: string | null;
};

export type MonthSheet = {
  rows: DayRow[];
  totals: {
    late: number;
    penalty: number;
    earlyLeave: number;
    overtime: number;
    dayPenalties: number;
    siteDays: number;
    leaves: Record<string, number>;
  };
  money: {
    base: number;
    ratePerHour: number;
    deductions: number;
    overtimePay: number;
    leaveDeductions: number;
    dayPenaltyDeductions: number;
    total: number;
  };
};

const DAY_MS = 86_400_000;

function clockMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** A moment's local date ("yyyy-MM-dd") and minutes since local midnight. */
function local(iso: string, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Minutes of `iso` counted from the start of `day` (past midnight goes over 1440). */
function minutesFrom(day: string, iso: string, timeZone: string): number {
  const at = local(iso, timeZone);
  return daysBetween(day, at.date) * 1440 + at.minutes;
}

type DayClock = { in: ClockEvent | null; out: ClockEvent | null };

/**
 * Each day's first clock-in and last clock-out. A clock-out belongs to the
 * last clock-in still open if it comes within 24 hours (so after midnight
 * still counts for the day it started).
 */
function clocksByDay(events: ClockEvent[], timeZone: string): Map<string, DayClock> {
  const byDay = new Map<string, DayClock>();
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let open: { day: string; at: number } | null = null;
  for (const event of sorted) {
    const time = Date.parse(event.at);
    if (event.kind === "in") {
      const day = local(event.at, timeZone).date;
      const entry = byDay.get(day) ?? { in: null, out: null };
      if (!entry.in) entry.in = event;
      byDay.set(day, entry);
      open = { day, at: time };
      continue;
    }
    const day = open && time - open.at <= DAY_MS ? open.day : local(event.at, timeZone).date;
    const entry = byDay.get(day) ?? { in: null, out: null };
    if (!entry.out || Date.parse(entry.out.at) < time) entry.out = event;
    byDay.set(day, entry);
    open = null;
  }
  return byDay;
}

function ladderMinutes(
  penalty: { minutes: number[]; thenAdd: number },
  occurrence: number,
): number {
  const { minutes, thenAdd } = penalty;
  if (minutes.length === 0) return 0;
  if (occurrence <= minutes.length) return minutes[occurrence - 1]!;
  return minutes[minutes.length - 1]! + thenAdd * (occurrence - minutes.length);
}

export function monthSheet(input: {
  rules: WorkRules;
  month: string;
  baseSalary: number;
  overtimeRate?: number | null;
  events: ClockEvent[];
  corrections: Correction[];
  leaves: Leave[];
  holidays: string[];
}): MonthSheet {
  const { rules, month, baseSalary: base } = input;
  const [year, monthNumber] = month.split("-").map(Number);
  const length = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const start = clockMinutes(rules.dayStart);
  const end = clockMinutes(rules.dayEnd);
  const steps = [...rules.lateSteps].sort((a, b) => clockMinutes(a.after) - clockMinutes(b.after));
  const clocks = clocksByDay(input.events, rules.timezone);
  const leaveByDay = new Map(input.leaves.map((leave) => [leave.day, leave.typeId]));
  const holidays = new Set(input.holidays);
  let ladderCount = 0;

  const rows: DayRow[] = [];
  for (let date = 1; date <= length; date++) {
    const day = `${month}-${String(date).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year!, monthNumber! - 1, date)).getUTCDay();
    const clock = clocks.get(day) ?? { in: null, out: null };
    let inAt = clock.in?.at ?? null;
    let outAt = clock.out?.at ?? null;
    const corrected: ("in" | "out")[] = [];
    for (const correction of input.corrections) {
      if (correction.day !== day) continue;
      if (correction.field === "in") inAt = correction.at;
      else outAt = correction.at;
      if (!corrected.includes(correction.field)) corrected.push(correction.field);
    }
    const leaveTypeId = leaveByDay.get(day) ?? null;
    const kind: DayRow["kind"] = leaveTypeId
      ? "leave"
      : holidays.has(day)
        ? "holiday"
        : rules.workDays.includes(weekday)
          ? "work"
          : "off";
    const row: DayRow = {
      day,
      weekday,
      kind,
      in: kind === "leave" ? null : inAt,
      out: kind === "leave" ? null : outAt,
      late: 0,
      penalty: 0,
      dayPenalty: false,
      earlyLeave: 0,
      overtime: 0,
      site: kind !== "leave" && clock.in?.placeKind === "site",
      corrected,
      note: null,
      leaveTypeId,
    };
    rows.push(row);
    if (kind === "leave") continue;
    if (!row.in) {
      if (kind === "work") row.note = "absent-unexplained";
      continue;
    }
    const inMinutes = minutesFrom(day, row.in, rules.timezone);
    const outMinutes = row.out ? minutesFrom(day, row.out, rules.timezone) : null;
    if (outMinutes === null) row.note = "no-clock-out";

    if (kind === "work") {
      const step = [...steps].reverse().find((item) => inMinutes > clockMinutes(item.after));
      if (step?.penalty.kind === "day") {
        row.dayPenalty = true;
      } else if (step?.penalty.kind === "ladder") {
        ladderCount += 1;
        row.penalty = ladderMinutes(step.penalty, ladderCount);
      } else {
        row.late = Math.max(0, inMinutes - (start + rules.graceMinutes));
      }
      if (outMinutes !== null) {
        const before = rules.overtime.beforeStart ? Math.max(0, start - inMinutes) : 0;
        const after = rules.overtime.afterEnd ? Math.max(0, outMinutes - end) : 0;
        row.overtime = before + after;
        if (rules.earlyLeaveCounted) row.earlyLeave = Math.max(0, end - outMinutes);
      }
    } else if (outMinutes !== null && rules.overtime.dayOffAllOvertime) {
      row.overtime = Math.max(0, outMinutes - inMinutes);
    }
    if (row.overtime < rules.overtime.minimumMinutes) row.overtime = 0;
  }

  const sum = (pick: (row: DayRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const leaves: Record<string, number> = {};
  for (const row of rows) {
    if (row.leaveTypeId) leaves[row.leaveTypeId] = (leaves[row.leaveTypeId] ?? 0) + 1;
  }
  const totals = {
    late: sum((row) => row.late),
    penalty: sum((row) => row.penalty),
    earlyLeave: sum((row) => row.earlyLeave),
    overtime: sum((row) => row.overtime),
    dayPenalties: rows.filter((row) => row.dayPenalty).length,
    siteDays: rows.filter((row) => row.site).length,
    leaves,
  };

  const workDaysInMonth = rows.filter((row) => rules.workDays.includes(row.weekday)).length;
  const dayHours = (end - start) / 60;
  const ratePerHour =
    input.overtimeRate ??
    (rules.rate.kind === "fixed" ? rules.rate.perHour : base / (workDaysInMonth * dayHours));
  const deductions = Math.round(
    ((totals.late + totals.penalty + totals.earlyLeave) / 60) * ratePerHour,
  );
  const overtimePay = Math.round((totals.overtime / 60) * ratePerHour);
  const leaveDeductions = rows.reduce((total, row) => {
    const type = rules.leaveTypes.find((item) => item.id === row.leaveTypeId);
    return total + (type ? Math.round((base * type.percent) / 100) : 0);
  }, 0);
  const dayPenaltyDeductions =
    rules.dayPenaltyDivisor > 0
      ? Math.round(base / rules.dayPenaltyDivisor) * totals.dayPenalties
      : 0;
  const total =
    base -
    deductions +
    overtimePay -
    dayPenaltyDeductions -
    (rules.absenceFromTotal ? leaveDeductions : 0);

  return {
    rows,
    totals,
    money: {
      base,
      ratePerHour,
      deductions,
      overtimePay,
      leaveDeductions,
      dayPenaltyDeductions,
      total,
    },
  };
}
