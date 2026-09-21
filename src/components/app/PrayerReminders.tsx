import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Bell, BellOff } from "lucide-react";
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
  PRAYER_LABELS,
  PRAYER_NAMES,
  prayerLogsQuery,
  prayerSettingsQuery,
  statusOf,
} from "@/data/spirit";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import {
  canNotify,
  isAndroidApp,
  requestNotifications,
  scheduleReminders,
  type Reminder,
} from "@/lib/native";
import { prayerTimesFor } from "@/lib/prayer";

/** Per device: reminders fire on the phone they are set on. */
const STORAGE_KEY = "life-os-prayer-reminders";
type ReminderSettings = { enabled: boolean; leadMinutes: number };
const DEFAULTS: ReminderSettings = { enabled: false, leadMinutes: 10 };

function readSettings(): ReminderSettings {
  try {
    return {
      ...DEFAULTS,
      ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ReminderSettings>),
    };
  } catch {
    return DEFAULTS;
  }
}

function writeSettings(settings: ReminderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked; settings last for this session.
  }
  window.dispatchEvent(new Event("life-os-reminders-changed"));
}

/**
 * Keeps the phone's prayer reminders scheduled for the next 7 days. Mounted
 * once in the app layout; reschedules when times, logs or settings change.
 * A prayer already logged today is not reminded.
 */
export function usePrayerReminderSync() {
  const { enabled: modules } = useModules();
  const settingsQuery = useQuery({ ...prayerSettingsQuery(), enabled: isAndroidApp() });
  const logs = useQuery({ ...prayerLogsQuery(), enabled: isAndroidApp() });
  const { fmtTime } = usePreferences();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    setSettings(readSettings());
    const onChange = () => setSettings(readSettings());
    window.addEventListener("life-os-reminders-changed", onChange);
    return () => window.removeEventListener("life-os-reminders-changed", onChange);
  }, []);

  useEffect(() => {
    if (!isAndroidApp()) return;
    const config = settingsQuery.data;
    const on = settings.enabled && modules.includes("spirit");
    if (!on || config?.latitude == null || config.longitude == null) {
      scheduleReminders([]);
      return;
    }
    const now = Date.now();
    const reminders: Reminder[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = format(addDays(new Date(), offset), "yyyy-MM-dd");
      const times = prayerTimesFor(
        Number(config.latitude),
        Number(config.longitude),
        config.calc_method,
        config.asr_school,
        date,
      );
      for (const name of PRAYER_NAMES) {
        const time = times[name] as Date;
        const at = time.getTime() - settings.leadMinutes * 60_000;
        if (at <= now) continue;
        const logged = (logs.data ?? []).some(
          (log) => log.prayer_date === date && log.prayer_name === name && statusOf(log),
        );
        if (logged) continue;
        reminders.push({
          id: `${date}-${name}`,
          at,
          title:
            settings.leadMinutes > 0
              ? `${PRAYER_LABELS[name]} in ${settings.leadMinutes} minutes`
              : `${PRAYER_LABELS[name]} is now`,
          body: `${PRAYER_LABELS[name]} at ${fmtTime(time)}. Tap to log it.`,
          path: "/spirit",
        });
      }
    }
    scheduleReminders(reminders);
    // fmtTime changes identity every render; the time format is in preferences anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data, logs.data, settings, modules]);
}

/** Settings card on the Spirit page. */
export function PrayerReminderSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [allowed, setAllowed] = useState(true);
  const android = isAndroidApp();

  useEffect(() => {
    setSettings(readSettings());
    setAllowed(canNotify());
    const onFocus = () => setAllowed(canNotify());
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const update = (patch: Partial<ReminderSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
    if (patch.enabled && !canNotify()) requestNotifications();
  };

  return (
    <section className="stat-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {settings.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            Prayer reminders
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {android
              ? "A notification on this phone before each prayer you haven't logged yet."
              : "Reminders arrive as notifications in the Life OS Android app."}
          </p>
        </div>
        {android ? (
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
            aria-label="Prayer reminders"
          />
        ) : null}
      </div>
      {android && settings.enabled ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Remind me</Label>
            <Select
              value={String(settings.leadMinutes)}
              onValueChange={(value) => update({ leadMinutes: Number(value) })}
            >
              <SelectTrigger className="h-11 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 30].map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes === 0 ? "At the prayer time" : `${minutes} minutes before`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!allowed ? (
            <Button type="button" variant="outline" onClick={requestNotifications}>
              Allow notifications
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
