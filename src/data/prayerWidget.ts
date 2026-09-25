/**
 * What the Android prayer widget shows, worked out here (the widget can't
 * compute prayer times itself): the place, and for yesterday, today and
 * tomorrow each prayer's name and time plus how it was logged. Yesterday
 * and tomorrow let the widget count down and fill its bar across midnight.
 */
import { addDays, format, parseISO } from "date-fns";

import { PRAYER_NAMES, prayerLabel, statusOf, type PrayerLog, type PrayerName } from "./spirit";

export type WidgetPrayer = { key: PrayerName; label: string; at: number; status: string | null };
export type WidgetDay = { date: string; prayers: WidgetPrayer[] };
export type WidgetPayload = { place: string; updatedAt: number; days: WidgetDay[] };

export function buildWidgetPayload(args: {
  today: string;
  place: string | null;
  logs: PrayerLog[];
  /** Prayer times for a date (yyyy-MM-dd), e.g. from prayerTimesFor. */
  timesFor: (date: string) => Record<PrayerName, Date>;
  now?: number;
}): WidgetPayload {
  const days = [-1, 0, 1].map((offset) => {
    const date = format(addDays(parseISO(args.today), offset), "yyyy-MM-dd");
    const times = args.timesFor(date);
    return {
      date,
      prayers: PRAYER_NAMES.map((key) => {
        const log = args.logs.find((row) => row.prayer_date === date && row.prayer_name === key);
        return {
          key,
          label: prayerLabel(key, date),
          at: times[key].getTime(),
          status: statusOf(log),
        };
      }),
    };
  });
  return { place: args.place?.trim() || "Prayer times", updatedAt: args.now ?? Date.now(), days };
}
