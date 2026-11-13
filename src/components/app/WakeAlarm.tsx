import { AlarmClock } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { prayerLabel } from "@/data/spirit";
import { t } from "@/lib/i18n";
import { useCanSetAlarm } from "@/hooks/useWakeAlarm";
import {
  WAKE_MAX_MINUTES,
  readWake,
  writeWake,
  type WakePrayer,
  type WakeSettings,
} from "@/lib/wakeAlarm";

function useWakeSettings() {
  const [settings, setSettings] = useState<WakeSettings>(readWake);
  const update = (next: WakeSettings) => {
    setSettings(next);
    writeWake(next);
  };
  return [settings, update] as const;
}

const PER_PRAYER: WakePrayer[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

/** Minutes before (default 10), with an optional value for single prayers; or a note on the web. */
export function WakeAlarmSettings() {
  const can = useCanSetAlarm();
  const [settings, update] = useWakeSettings();
  if (!can) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlarmClock className="size-4 shrink-0" />
        {t("Wake-up alarms before a prayer (say, Fajr) work in the Life OS Android app.")}
      </p>
    );
  }
  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">{t("Wake-up alarm")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("Tap the alarm beside a prayer to set one in your phone's Clock app.")}
        </p>
      </div>
      <div className="space-y-2">
        <Label>
          {settings.minutes} {t("minutes before")}
        </Label>
        <Slider
          min={0}
          max={WAKE_MAX_MINUTES}
          step={5}
          value={[settings.minutes]}
          onValueChange={([value]) => update({ ...settings, minutes: value ?? 10 })}
          aria-label={t("minutes before")}
        />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {t("Different for one prayer")}
        </summary>
        <ul className="mt-3 space-y-2">
          {PER_PRAYER.map((name) => {
            const own = settings.each[name];
            return (
              <li key={name} className="flex items-center justify-between gap-3">
                <span>{name === "sunrise" ? t("Sunrise") : prayerLabel(name)}</span>
                <select
                  className="min-h-10 rounded-md border border-border bg-card px-2 text-sm"
                  value={own ?? ""}
                  aria-label={`${name === "sunrise" ? t("Sunrise") : prayerLabel(name)}: ${t("minutes before")}`}
                  onChange={(event) => {
                    const each = { ...settings.each };
                    if (event.target.value === "") delete each[name];
                    else each[name] = Number(event.target.value);
                    update({ ...settings, each });
                  }}
                >
                  <option value="">{t("Same as above")}</option>
                  {[0, 5, 10, 15, 20, 25, 30, 45, 60].map((value) => (
                    <option key={value} value={value}>
                      {value} {t("min")}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
