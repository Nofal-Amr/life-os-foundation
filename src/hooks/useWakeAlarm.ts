import { useEffect, useState } from "react";
import { toast } from "sonner";

import { prayerLabel, type PrayerName } from "@/data/spirit";
import { t } from "@/lib/i18n";
import { canSetAlarm, setPhoneAlarm } from "@/lib/native";
import { minutesBefore, readWake, wakeAlarmAt, type WakePrayer } from "@/lib/wakeAlarm";

type DayTimes = Record<WakePrayer, Date>;

/** Whether this phone can set Clock alarms. Read after mount (no bridge on the server). */
export function useCanSetAlarm(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(canSetAlarm()), []);
  return can;
}

/**
 * The tap beside a prayer: one wake-up alarm in the phone's Clock app, N
 * minutes before that prayer's next time. A wake-up aid, not the adhan.
 */
export function wakeAlarmHandler(
  can: boolean,
  today: DayTimes | null,
  tomorrow: DayTimes | null,
  formatTime: (date: Date) => string,
): ((name: PrayerName | "sunrise") => void) | undefined {
  if (!can || !today || !tomorrow) return undefined;
  return (name) => {
    const minutes = minutesBefore(readWake(), name);
    const { at, tomorrow: isTomorrow } = wakeAlarmAt(
      new Date(),
      today[name],
      tomorrow[name],
      minutes,
    );
    const label = name === "sunrise" ? t("Sunrise") : prayerLabel(name, at);
    if (!setPhoneAlarm(at, `${t("Wake-up for")} ${label}`)) {
      toast.error(t("No clock app on this phone takes alarms."));
      return;
    }
    toast.success(
      `${t("Alarm set for")} ${formatTime(at)}${isTomorrow ? ` (${t("tomorrow")})` : ""}`,
      { description: t("One time only. Tap again for another day.") },
    );
  };
}
