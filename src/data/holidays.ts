/**
 * Holidays, opt-in, per device:
 * - public holidays for a country you choose, from the free Nager.Date
 *   service (only the country code and year are sent), cached on the device;
 * - Islamic occasions worked out on the device from the Umm al-Qura Hijri
 *   calendar (offline). Lunar dates can move a day with the moon sighting,
 *   so they're shown as expected dates.
 * You can hide any day you don't want to see.
 */
import { queryOptions } from "@tanstack/react-query";
import { addDays, format } from "date-fns";

export type Holiday = {
  date: string;
  name: string;
  localName: string | null;
  kind: "public" | "islamic";
};

export type HolidaySettings = { country: string | null; islamic: boolean; hidden: string[] };

const SETTINGS_KEY = "holidays:settings";
export const DEFAULT_HOLIDAYS: HolidaySettings = { country: null, islamic: false, hidden: [] };

export function readHolidaySettings(): HolidaySettings {
  try {
    return {
      ...DEFAULT_HOLIDAYS,
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<HolidaySettings>),
    };
  } catch {
    return DEFAULT_HOLIDAYS;
  }
}

export function writeHolidaySettings(settings: HolidaySettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Kept for this session.
  }
  window.dispatchEvent(new Event("life-os-holidays"));
}

/** A stable id for hiding one holiday on one day. */
export const holidayKey = (holiday: Holiday) => `${holiday.date}|${holiday.name}`;

/* --------------------------------------------------------- Islamic days */

const ISLAMIC: { month: number; day: number; name: string; localName: string }[] = [
  { month: 1, day: 1, name: "Islamic New Year", localName: "رأس السنة الهجرية" },
  { month: 1, day: 10, name: "Ashura", localName: "عاشوراء" },
  { month: 3, day: 12, name: "Mawlid an-Nabi", localName: "المولد النبوي" },
  { month: 9, day: 1, name: "Ramadan begins", localName: "أول رمضان" },
  { month: 10, day: 1, name: "Eid al-Fitr", localName: "عيد الفطر" },
  { month: 12, day: 9, name: "Day of Arafah", localName: "يوم عرفة" },
  { month: 12, day: 10, name: "Eid al-Adha", localName: "عيد الأضحى" },
];

const hijri = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
});

/** Hijri month and day for a date (Umm al-Qura). */
export function hijriOf(date: Date): { month: number; day: number } {
  const parts = hijri.formatToParts(date);
  return {
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/** Islamic occasions falling in a Gregorian year. */
export function islamicDays(year: number): Holiday[] {
  const out: Holiday[] = [];
  for (let date = new Date(year, 0, 1, 12); date.getFullYear() === year; date = addDays(date, 1)) {
    const { month, day } = hijriOf(date);
    const match = ISLAMIC.find((item) => item.month === month && item.day === day);
    if (match) {
      out.push({
        date: format(date, "yyyy-MM-dd"),
        name: match.name,
        localName: match.localName,
        kind: "islamic",
      });
    }
  }
  return out;
}

/* ------------------------------------------------------ public holidays */

type NagerHoliday = { date: string; name: string; localName: string };

async function publicHolidays(year: number, country: string): Promise<Holiday[]> {
  const cacheKey = `holidays:${country}:${year}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as Holiday[];
  } catch {
    // Fetch instead.
  }
  const response = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(country)}`,
  );
  if (!response.ok) return [];
  const list = ((await response.json()) as NagerHoliday[]).map((item) => ({
    date: item.date,
    name: item.name,
    localName: item.localName && item.localName !== item.name ? item.localName : null,
    kind: "public" as const,
  }));
  try {
    localStorage.setItem(cacheKey, JSON.stringify(list));
  } catch {
    // Not cached.
  }
  return list;
}

export type Country = { countryCode: string; name: string };

export const countriesQuery = () =>
  queryOptions({
    queryKey: ["holiday-countries"],
    staleTime: Infinity,
    queryFn: async (): Promise<Country[]> => {
      const response = await fetch("https://date.nager.at/api/v3/AvailableCountries");
      if (!response.ok) throw new Error("Couldn't load the list of countries.");
      return ((await response.json()) as Country[]).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

/** This year's and next year's holidays for the settings, hidden ones left out. */
export const holidaysQuery = (settings: HolidaySettings, year = new Date().getFullYear()) =>
  queryOptions({
    queryKey: ["holidays", settings.country, settings.islamic, year],
    staleTime: Infinity,
    queryFn: async (): Promise<Holiday[]> => {
      const list: Holiday[] = [];
      for (const y of [year, year + 1]) {
        if (settings.country) {
          try {
            list.push(...(await publicHolidays(y, settings.country)));
          } catch {
            // Offline and not cached yet: Islamic days still show.
          }
        }
        if (settings.islamic) list.push(...islamicDays(y));
      }
      return list.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

export function visibleHolidays(list: Holiday[], settings: HolidaySettings): Holiday[] {
  const hidden = new Set(settings.hidden);
  return list.filter((holiday) => !hidden.has(holidayKey(holiday)));
}
