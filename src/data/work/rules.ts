/**
 * The work side's rules engine: clock events, leave and corrections in, the
 * month's attendance and pay sheet out. It is the only place pay is worked
 * out. Every number comes from the company's rules — HR makes them; the ADO
 * sheet is one ready-made preset, and nothing here assumes its numbers.
 */

export type LeaveType = {
  id: string;
  name: string;
  percent: number;
  /** Comes out of each worker's yearly paid-vacation days. Unset: only "annual". */
  fromAllowance?: boolean;
};

/** Arriving after `after` ("HH:mm") gives a penalty instead of late minutes. */
export type LateStep = {
  after: string;
  /**
   * Minutes past `after` that still don't trigger this step: with 08:30 and
   * 2, a clock-in at 08:32 has no penalty from it and 08:33 has. Unset is 0.
   */
  tolerance?: number;
  penalty:
    | {
        kind: "ladder";
        minutes: number[];
        thenAdd: number;
        /**
         * After the last rung: keep adding `thenAdd` minutes each time ("add",
         * the default), or a whole day's penalty and then start the ladder
         * again ("day": 120, 150, 180, a day, 120, 150, 180, a day…).
         */
        afterLast?: "add" | "day";
      }
    | { kind: "day" };
};

/**
 * Options a company can try before they are for everyone. Each is off unless
 * an admin of that company turns it on.
 */
export type WorkTests = {
  /** Sheets: import past days from WhatsApp messages. */
  whatsappImport: boolean;
  /** After clocking in or out, offer to post it in WhatsApp with the time. */
  whatsappPost: boolean;
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
    /**
     * A work day that costs a day's penalty (arriving after the day step, or
     * the ladder's day) counts entirely as overtime, from clock-in to
     * clock-out, with no early-leave minutes. Unset in saved rules is false.
     */
    dayPenaltyAllOvertime: boolean;
    minimumMinutes: number;
  };
  /** Per hour, for overtime pay and for late / penalty / early-leave deductions. */
  rate: { kind: "fixed"; perHour: number } | { kind: "fromSalary" };
  earlyLeaveCounted: boolean;
  leaveTypes: LeaveType[];
  /** A day's penalty costs base salary ÷ this (20 is 5%). */
  dayPenaltyDivisor: number;
  /** Whether leave deductions come off the month's total. */
  absenceFromTotal: boolean;
  outsideRadius: "refuse" | "refuseAndRecord" | "allowWithReason";
  /** The company's official days off ("yyyy-MM-dd"): nobody is absent on them. */
  holidays: { day: string; name: string }[];
  tests: WorkTests;
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
    {
      after: "08:30",
      tolerance: 2,
      penalty: { kind: "ladder", minutes: [120, 150, 180], thenAdd: 30, afterLast: "day" },
    },
    { after: "10:00", penalty: { kind: "day" } },
  ],
  overtime: {
    beforeStart: true,
    afterEnd: true,
    dayOffAllOvertime: true,
    dayPenaltyAllOvertime: true,
    minimumMinutes: 0,
  },
  rate: { kind: "fixed", perHour: 47 },
  earlyLeaveCounted: true,
  leaveTypes: [
    { id: "with", name: "Leave with permission", percent: 5 },
    { id: "without", name: "Leave without permission", percent: 7 },
    { id: "annual", name: "Annual leave", percent: 0 },
  ],
  dayPenaltyDivisor: 20,
  absenceFromTotal: true,
  outsideRadius: "refuseAndRecord",
  holidays: [],
  tests: { whatsappImport: false, whatsappPost: false },
};

export type ClockEvent = { kind: "in" | "out"; at: string; placeKind?: "office" | "site" };
/** An admin's change to a day's time; `at: null` removes it. */
export type Correction = { day: string; field: "in" | "out"; at: string | null; reason: string };
export type Leave = { day: string; typeId: string };
/** What an admin excused on a day: the late arrival, the early leave, both, or (none) nothing any more. */
export type ExcuseCovers = "late" | "early" | "both" | "none";
export type Excuse = { day: string; covers: ExcuseCovers };

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
  /**
   * Excused by an admin: an excused late arrival costs nothing (no late
   * minutes, no penalty, not counted on the ladder); an excused early leave
   * costs no early-leave minutes.
   */
  excused: ("late" | "early")[];
  /** Before, on or after today: today and later days are never "absent". */
  when: "past" | "today" | "future";
  /**
   * The day's other taps, between the first clock-in and the last clock-out
   * (a break, a trip out). Shown on the sheet; pay uses the first and last.
   */
  between: ClockEvent[];
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
    /** Late minutes' cost. */
    lateDeductions: number;
    /** The ladder's penalty minutes' cost. */
    penaltyDeductions: number;
    /** Early-leave minutes' cost. */
    earlyLeaveDeductions: number;
    /** Late + penalty + early leave, together. */
    deductions: number;
    overtimePay: number;
    /** What one day's penalty costs (base salary / the divisor). */
    dayPenaltyRate: number;
    leaveDeductions: number;
    dayPenaltyDeductions: number;
    /** Everything taken off: minutes, day penalties and (when they count) leave. */
    totalDeductions: number;
    /** Everything added: overtime. */
    totalAdditions: number;
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

type DayClock = { in: ClockEvent | null; out: ClockEvent | null; all: ClockEvent[] };

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
      const entry = byDay.get(day) ?? { in: null, out: null, all: [] };
      entry.all.push(event);
      if (!entry.in) entry.in = event;
      byDay.set(day, entry);
      open = { day, at: time };
      continue;
    }
    const day = open && time - open.at <= DAY_MS ? open.day : local(event.at, timeZone).date;
    const entry = byDay.get(day) ?? { in: null, out: null, all: [] };
    entry.all.push(event);
    if (!entry.out || Date.parse(entry.out.at) < time) entry.out = event;
    byDay.set(day, entry);
    open = null;
  }
  return byDay;
}

type Tap = { kind: "in" | "out"; at: string };

/**
 * A day's taps once an admin's corrections are applied, the one list the
 * clock card and the sheet both show. The first clock-in and the last
 * clock-out are the day's anchors: a correction replaces one (the latest
 * wins) or, with `null`, removes it. Taps outside the corrected in–out
 * window are dropped, and so is a repeat tap (a second clock-in while
 * already in keeps the first; a second clock-out keeps the last).
 */
export function dayTaps<T extends Tap>(
  raw: T[],
  corrections: { field: "in" | "out"; at: string | null }[],
): {
  in: string | null;
  out: string | null;
  corrected: ("in" | "out")[];
  /** In time order; a corrected anchor is a plain `{ kind, at }`. */
  taps: (T | Tap)[];
  /** The taps between the anchors. */
  between: T[];
} {
  const sorted = [...raw].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const firstIn = sorted.find((tap) => tap.kind === "in") ?? null;
  const lastOut = sorted.filter((tap) => tap.kind === "out").at(-1) ?? null;
  let inAt = firstIn?.at ?? null;
  let outAt = lastOut?.at ?? null;
  const corrected: ("in" | "out")[] = [];
  for (const item of corrections) {
    if (item.field === "in") inAt = item.at;
    else outAt = item.at;
    if (!corrected.includes(item.field)) corrected.push(item.field);
  }
  const from = inAt ? Date.parse(inAt) : -Infinity;
  const to = outAt ? Date.parse(outAt) : Infinity;
  const inside = sorted.filter(
    (tap) =>
      tap !== firstIn && tap !== lastOut && Date.parse(tap.at) > from && Date.parse(tap.at) < to,
  );
  const inTap: T | Tap | null = inAt
    ? firstIn && !corrected.includes("in")
      ? firstIn
      : { kind: "in", at: inAt }
    : null;
  const outTap: T | Tap | null = outAt
    ? lastOut && !corrected.includes("out")
      ? lastOut
      : { kind: "out", at: outAt }
    : null;
  const ordered = [...(inTap ? [inTap] : []), ...inside, ...(outTap ? [outTap] : [])];
  const taps: (T | Tap)[] = [];
  for (const tap of ordered) {
    const last = taps.at(-1);
    if (last && last.kind === tap.kind) {
      // in, in: keep the first. out, out: keep the last.
      if (tap.kind === "out") taps[taps.length - 1] = tap;
      continue;
    }
    taps.push(tap);
  }
  const between = taps.filter((tap) => tap !== inTap && tap !== outTap) as T[];
  return { in: inAt, out: outAt, corrected, taps, between };
}

function excusedOn(covers: ExcuseCovers | undefined): ("late" | "early")[] {
  if (covers === "both") return ["late", "early"];
  if (covers === "late" || covers === "early") return [covers];
  return [];
}

/** The penalty for the n-th time this month (1-based): minutes, or a whole day. */
export function ladderPenalty(
  penalty: { minutes: number[]; thenAdd: number; afterLast?: "add" | "day" },
  occurrence: number,
): { minutes: number; day: boolean } {
  const { minutes, thenAdd } = penalty;
  if (minutes.length === 0) return { minutes: 0, day: false };
  if (penalty.afterLast === "day") {
    const place = (occurrence - 1) % (minutes.length + 1);
    return place < minutes.length
      ? { minutes: minutes[place]!, day: false }
      : { minutes: 0, day: true };
  }
  if (occurrence <= minutes.length) return { minutes: minutes[occurrence - 1]!, day: false };
  return {
    minutes: minutes[minutes.length - 1]! + thenAdd * (occurrence - minutes.length),
    day: false,
  };
}

export function monthSheet(input: {
  rules: WorkRules;
  month: string;
  baseSalary: number;
  overtimeRate?: number | null;
  events: ClockEvent[];
  corrections: Correction[];
  leaves: Leave[];
  /** An admin's excuses; for a day, the latest wins. */
  excuses?: Excuse[];
  holidays: string[];
  /** Today ("yyyy-MM-dd", the company's time zone). Unset: the whole month is past. */
  today?: string;
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
  const excuseByDay = new Map<string, ExcuseCovers>();
  for (const excuse of input.excuses ?? []) excuseByDay.set(excuse.day, excuse.covers);
  let ladderCount = 0;

  const rows: DayRow[] = [];
  for (let date = 1; date <= length; date++) {
    const day = `${month}-${String(date).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year!, monthNumber! - 1, date)).getUTCDay();
    const clock = clocks.get(day) ?? { in: null, out: null, all: [] };
    const {
      in: inAt,
      out: outAt,
      corrected,
      between,
    } = dayTaps(
      clock.all,
      input.corrections.filter((correction) => correction.day === day),
    );
    const leaveTypeId = leaveByDay.get(day) ?? null;
    const kind: DayRow["kind"] = leaveTypeId
      ? "leave"
      : holidays.has(day)
        ? "holiday"
        : rules.workDays.includes(weekday)
          ? "work"
          : "off";
    const when: DayRow["when"] = !input.today
      ? "past"
      : day < input.today
        ? "past"
        : day === input.today
          ? "today"
          : "future";
    const row: DayRow = {
      day,
      when,
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
      excused: excusedOn(excuseByDay.get(day)),
      between: kind === "leave" ? [] : between,
      note: null,
      leaveTypeId,
    };
    rows.push(row);
    if (kind === "leave") continue;
    if (!row.in) {
      if (kind === "work" && when === "past") row.note = "absent-unexplained";
      continue;
    }
    const inMinutes = minutesFrom(day, row.in, rules.timezone);
    const outMinutes = row.out ? minutesFrom(day, row.out, rules.timezone) : null;
    if (outMinutes === null && when !== "today") row.note = "no-clock-out";

    if (kind === "work") {
      // An excused late arrival costs nothing and isn't counted on the ladder.
      const step = row.excused.includes("late")
        ? undefined
        : [...steps]
            .reverse()
            .find((item) => inMinutes > clockMinutes(item.after) + (item.tolerance ?? 0));
      if (step?.penalty.kind === "day") {
        row.dayPenalty = true;
      } else if (step?.penalty.kind === "ladder") {
        ladderCount += 1;
        const result = ladderPenalty(step.penalty, ladderCount);
        row.penalty = result.minutes;
        row.dayPenalty = result.day;
      } else if (!row.excused.includes("late")) {
        row.late = Math.max(0, inMinutes - (start + rules.graceMinutes));
      }
      if (outMinutes !== null && row.dayPenalty && rules.overtime.dayPenaltyAllOvertime) {
        row.overtime = Math.max(0, outMinutes - inMinutes);
      } else if (outMinutes !== null) {
        const before = rules.overtime.beforeStart ? Math.max(0, start - inMinutes) : 0;
        const after = rules.overtime.afterEnd ? Math.max(0, outMinutes - end) : 0;
        row.overtime = before + after;
        if (rules.earlyLeaveCounted && !row.excused.includes("early"))
          row.earlyLeave = Math.max(0, end - outMinutes);
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
  const cost = (minutes: number) => Math.round((minutes / 60) * ratePerHour);
  const lateDeductions = cost(totals.late);
  const penaltyDeductions = cost(totals.penalty);
  const earlyLeaveDeductions = cost(totals.earlyLeave);
  const deductions = lateDeductions + penaltyDeductions + earlyLeaveDeductions;
  const overtimePay = Math.round((totals.overtime / 60) * ratePerHour);
  const leaveDeductions = rows.reduce((total, row) => {
    const type = rules.leaveTypes.find((item) => item.id === row.leaveTypeId);
    return total + (type ? Math.round((base * type.percent) / 100) : 0);
  }, 0);
  const dayPenaltyRate =
    rules.dayPenaltyDivisor > 0 ? Math.round(base / rules.dayPenaltyDivisor) : 0;
  const dayPenaltyDeductions = dayPenaltyRate * totals.dayPenalties;
  const totalDeductions =
    deductions + dayPenaltyDeductions + (rules.absenceFromTotal ? leaveDeductions : 0);
  const totalAdditions = overtimePay;
  const total = base - totalDeductions + totalAdditions;

  return {
    rows,
    totals,
    money: {
      base,
      ratePerHour,
      lateDeductions,
      penaltyDeductions,
      earlyLeaveDeductions,
      deductions,
      overtimePay,
      dayPenaltyRate,
      leaveDeductions,
      dayPenaltyDeductions,
      totalDeductions,
      totalAdditions,
      total,
    },
  };
}
