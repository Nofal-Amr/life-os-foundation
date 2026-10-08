import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_HOLIDAYS,
  countriesQuery,
  holidayKey,
  holidaysQuery,
  readHolidaySettings,
  visibleHolidays,
  writeHolidaySettings,
  type Holiday,
  type HolidaySettings,
} from "@/data/holidays";
import { todayISO } from "@/lib/date";

/** The holiday settings on this device, kept in step across the app. */
export function useHolidaySettings() {
  const [settings, setSettings] = useState<HolidaySettings>(DEFAULT_HOLIDAYS);
  useEffect(() => {
    setSettings(readHolidaySettings());
    const onChange = () => setSettings(readHolidaySettings());
    window.addEventListener("life-os-holidays", onChange);
    return () => window.removeEventListener("life-os-holidays", onChange);
  }, []);
  const update = (patch: Partial<HolidaySettings>) =>
    writeHolidaySettings({ ...readHolidaySettings(), ...patch });
  return [settings, update] as const;
}

/** Holidays to show (this year and next), or [] when none are turned on. */
export function useHolidays(): Holiday[] {
  const [settings] = useHolidaySettings();
  const on = !!settings.country || settings.islamic;
  const list = useQuery({ ...holidaysQuery(settings), enabled: on });
  return on ? visibleHolidays(list.data ?? [], settings) : [];
}

/** Settings: pick a country, Islamic occasions, and hide days you don't want. */
export function HolidaysCard() {
  const [settings, update] = useHolidaySettings();
  const countries = useQuery({ ...countriesQuery(), enabled: true });
  const all = useQuery({
    ...holidaysQuery(settings),
    enabled: !!settings.country || settings.islamic,
  });
  const today = todayISO();
  const upcoming = (all.data ?? []).filter((holiday) => holiday.date >= today).slice(0, 8);
  const hidden = new Set(settings.hidden);

  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <PartyPopper className="size-4" /> Holidays
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on the Calendar and in Today's Coming up. Public holidays come from Nager.Date (only
          the country and year are sent); Islamic occasions are worked out on this device and may
          move a day with the moon sighting.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Public holidays for</Label>
        <Select
          value={settings.country ?? "none"}
          onValueChange={(value) => update({ country: value === "none" ? null : value })}
        >
          <SelectTrigger className="h-11 w-64">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {(countries.data ?? [{ countryCode: "EG", name: "Egypt" }]).map((country) => (
              <SelectItem key={country.countryCode} value={country.countryCode}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="islamic-days">Islamic occasions (Ramadan, Eids, Arafah…)</Label>
        <Switch
          id="islamic-days"
          checked={settings.islamic}
          onCheckedChange={(islamic) => update({ islamic })}
        />
      </div>
      {upcoming.length ? (
        <ul className="space-y-1.5 text-sm">
          {upcoming.map((holiday) => {
            const key = holidayKey(holiday);
            const off = hidden.has(key);
            return (
              <li key={key} className="flex items-center justify-between gap-2">
                <span className={off ? "text-muted-foreground line-through" : ""}>
                  {format(parseISO(holiday.date), "EEE d MMM")} · {holiday.name}
                  {holiday.kind === "islamic" ? " (expected)" : ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      hidden: off
                        ? settings.hidden.filter((item) => item !== key)
                        : [...settings.hidden, key],
                    })
                  }
                >
                  {off ? "Show" : "Hide"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
