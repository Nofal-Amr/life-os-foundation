import { format, parseISO } from "date-fns";

export type UnitSystem = "metric" | "imperial";
export type TimeFormat = "24h" | "12h";
export type DateFormat = "dmy" | "mdy" | "iso";

export type DisplayPreferences = {
  unit_system: UnitSystem;
  time_format: TimeFormat;
  date_format: DateFormat;
  /** Null until the user chooses one — we never guess a currency. */
  currency: string | null;
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  unit_system: "metric",
  time_format: "24h",
  date_format: "dmy",
  currency: null,
};

export const CURRENCIES: { value: string; label: string }[] = [
  { value: "GBP", label: "British pound (£)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US dollar ($)" },
  { value: "CAD", label: "Canadian dollar (C$)" },
  { value: "AUD", label: "Australian dollar (A$)" },
  { value: "AED", label: "UAE dirham (د.إ)" },
  { value: "SAR", label: "Saudi riyal (﷼)" },
  { value: "PKR", label: "Pakistani rupee (₨)" },
  { value: "INR", label: "Indian rupee (₹)" },
  { value: "TRY", label: "Turkish lira (₺)" },
  { value: "CHF", label: "Swiss franc (CHF)" },
  { value: "SEK", label: "Swedish krona (kr)" },
  { value: "NOK", label: "Norwegian krone (kr)" },
  { value: "ZAR", label: "South African rand (R)" },
];

export const UNIT_SYSTEMS: { value: UnitSystem; label: string }[] = [
  { value: "metric", label: "Metric (cm, kg)" },
  { value: "imperial", label: "Imperial (ft/in, lb)" },
];

export const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: "24h", label: "24-hour (17:30)" },
  { value: "12h", label: "12-hour (5:30 pm)" },
];

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "dmy", label: "Day first (4 Mar 2026)" },
  { value: "mdy", label: "Month first (Mar 4, 2026)" },
  { value: "iso", label: "ISO (2026-03-04)" },
];

export function datePattern(preference: DateFormat): string {
  if (preference === "mdy") return "MMM d, yyyy";
  if (preference === "iso") return "yyyy-MM-dd";
  return "d MMM yyyy";
}

export function timePattern(preference: TimeFormat): string {
  return preference === "12h" ? "h:mm a" : "HH:mm";
}

/** Format an ISO date (yyyy-MM-dd) using the user's date preference. */
export function formatDatePref(value: string | null | undefined, prefs: DisplayPreferences): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), datePattern(prefs.date_format));
  } catch {
    return value;
  }
}

export function formatLongDatePref(date: Date, prefs: DisplayPreferences): string {
  return prefs.date_format === "iso"
    ? format(date, "EEEE yyyy-MM-dd")
    : prefs.date_format === "mdy"
      ? format(date, "EEEE, MMMM d")
      : format(date, "EEEE, d MMMM");
}

export function formatTimePref(date: Date, prefs: DisplayPreferences): string {
  return format(date, timePattern(prefs.time_format));
}

/** Format a stored "HH:mm" slot for display. */
export function formatSlotPref(slot: string, prefs: DisplayPreferences): string {
  const [hoursPart, minutesPart] = slot.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart ?? "0");
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return slot;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatTimePref(date, prefs);
}

export function formatDateTimePref(
  value: string | null | undefined,
  prefs: DisplayPreferences,
): string {
  if (!value) return "—";
  try {
    return format(new Date(value), `${datePattern(prefs.date_format)}, ${timePattern(prefs.time_format)}`);
  } catch {
    return value;
  }
}

/* ---------- units: always stored metric, converted only for display ---------- */

const LB_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 10) / 10;
  return inches === 12 ? { feet: feet + 1, inches: 0 } : { feet, inches };
}

export function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

export function weightUnit(prefs: DisplayPreferences): string {
  return prefs.unit_system === "imperial" ? "lb" : "kg";
}

/** Convert a stored kg value to the number shown in an input. */
export function weightToDisplay(kg: number | null, prefs: DisplayPreferences): number | null {
  if (kg == null) return null;
  const value = prefs.unit_system === "imperial" ? kgToLb(kg) : kg;
  return Math.round(value * 10) / 10;
}

/** Convert an entered weight back to kg for storage. */
export function weightToStored(value: number | null, prefs: DisplayPreferences): number | null {
  if (value == null) return null;
  const kg = prefs.unit_system === "imperial" ? lbToKg(value) : value;
  return Math.round(kg * 100) / 100;
}

export function formatWeight(kg: number | null, prefs: DisplayPreferences): string {
  const value = weightToDisplay(kg, prefs);
  if (value == null) return "—";
  return `${value.toFixed(1)} ${weightUnit(prefs)}`;
}

export function formatHeight(cm: number | null, prefs: DisplayPreferences): string {
  if (cm == null) return "—";
  if (prefs.unit_system === "imperial") {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet} ft ${inches} in`;
  }
  return `${Math.round(cm * 10) / 10} cm`;
}

/** Plain descriptive context for a BMI figure. Descriptive only, not advice. */
export function bmiContext(value: number): string {
  if (value < 18.5) return "That sits in the range usually described as underweight.";
  if (value < 25) return "That sits in the range usually described as a healthy weight.";
  if (value < 30) return "That sits in the range usually described as overweight.";
  return "That sits in the range usually described as obese.";
}

/* ---------- money: grouped figures, currency only once the user picks one ---------- */

/** Absolute money figure. No symbol until a currency is chosen in Settings. */
export function formatMoney(value: number | null | undefined, prefs: DisplayPreferences): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const amount = Number(value);
  if (prefs.currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: prefs.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      /* fall through to plain grouping */
    }
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Signed amounts always carry a word, so meaning never rests on colour. */
export function formatSignedMoney(
  value: number | null | undefined,
  prefs: DisplayPreferences,
): { amount: string; label: string } {
  const amount = Number(value ?? 0);
  return {
    amount: `${amount < 0 ? "−" : "+"}${formatMoney(Math.abs(amount), prefs)}`,
    label: amount < 0 ? "out" : "in",
  };
}
