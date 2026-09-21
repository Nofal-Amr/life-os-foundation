import { useQuery } from "@tanstack/react-query";

import { preferencesQuery } from "@/data/preferences";
import { toWeekStartsOn } from "@/data/week";
import {
  DEFAULT_DISPLAY_PREFERENCES,
  formatDatePref,
  formatDateTimePref,
  formatHeight,
  formatLongDatePref,
  formatMoney,
  formatShortDatePref,
  formatSignedMoney,
  formatSlotPref,
  formatTimePref,
  formatWeight,
  weightUnit,
  type DateFormat,
  type DisplayPreferences,
  type TimeFormat,
  type UnitSystem,
} from "@/lib/format";

/**
 * Display preferences (units, time and date format) with sensible defaults so
 * the UI renders correctly before the row loads.
 */
export function usePreferences() {
  const query = useQuery(preferencesQuery());
  const row = query.data;

  const prefs: DisplayPreferences = {
    unit_system: (row?.unit_system as UnitSystem) ?? DEFAULT_DISPLAY_PREFERENCES.unit_system,
    time_format: (row?.time_format as TimeFormat) ?? DEFAULT_DISPLAY_PREFERENCES.time_format,
    date_format: (row?.date_format as DateFormat) ?? DEFAULT_DISPLAY_PREFERENCES.date_format,
    currency: row?.currency ?? DEFAULT_DISPLAY_PREFERENCES.currency,
  };

  return {
    prefs,
    isLoading: query.isLoading,
    /** Which day weeks start on in the Week view and weekly charts. */
    weekStartsOn: toWeekStartsOn(row?.week_start),
    skin: row?.skin === "rpg" ? ("rpg" as const) : ("serious" as const),
    currency: prefs.currency,
    fmtDate: (value: string | null | undefined) => formatDatePref(value, prefs),
    fmtShortDate: (value: string | null | undefined) => formatShortDatePref(value, prefs),
    fmtLongDate: (date: Date) => formatLongDatePref(date, prefs),
    fmtTime: (date: Date) => formatTimePref(date, prefs),
    fmtSlot: (slot: string) => formatSlotPref(slot, prefs),
    fmtDateTime: (value: string | null | undefined) => formatDateTimePref(value, prefs),
    fmtWeight: (kg: number | null) => formatWeight(kg, prefs),
    fmtHeight: (cm: number | null) => formatHeight(cm, prefs),
    fmtMoney: (value: number | null | undefined) => formatMoney(value, prefs),
    fmtSignedMoney: (value: number | null | undefined) => formatSignedMoney(value, prefs),
    weightUnit: weightUnit(prefs),
  };
}
