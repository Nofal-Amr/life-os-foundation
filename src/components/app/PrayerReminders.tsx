import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Bell, BellOff, ListChecks, Moon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DEFAULT_REMINDERS,
  taskReminders,
  timedTaskReminders,
  type ReminderSettings,
} from "@/data/reminders";
import { reminderNotifications, userRemindersQuery } from "@/data/userReminders";
import {
  prayerLabel,
  prayerWindowEnds,
  PRAYER_NAMES,
  prayerLogsQuery,
  prayerSettingsQuery,
  statusOf,
} from "@/data/spirit";
import { tasksQuery } from "@/data/tasks";
import { useModules } from "@/hooks/useModules";
import { usePreferences } from "@/hooks/usePreferences";
import { todayISO } from "@/lib/date";
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
const ASKED_KEY = "life-os-notifications-asked";

function readSettings(): ReminderSettings {
  try {
    return {
      ...DEFAULT_REMINDERS,
      ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ReminderSettings>),
    };
  } catch {
    return DEFAULT_REMINDERS;
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

function useReminderSettings() {
  const [settings, setSettings] = useState(DEFAULT_REMINDERS);
  useEffect(() => {
    setSettings(readSettings());
    const onChange = () => setSettings(readSettings());
    window.addEventListener("life-os-reminders-changed", onChange);
    return () => window.removeEventListener("life-os-reminders-changed", onChange);
  }, []);
  const update = (patch: Partial<ReminderSettings>) => {
    const next = { ...readSettings(), ...patch };
    writeSettings(next);
    if ((patch.enabled || patch.tasksEnabled) && !canNotify()) requestNotifications();
  };
  return [settings, update] as const;
}

/**
 * Keeps the phone's reminders scheduled for the next 7 days: one before each
 * prayer not yet logged, and a daily summary of tasks due. Mounted once in
 * the app layout; reschedules whenever times, logs, tasks or settings change.
 */
export function useReminderSync() {
  const android = isAndroidApp();
  const { enabled: modules } = useModules();
  const prayerSettings = useQuery({ ...prayerSettingsQuery(), enabled: android });
  const logs = useQuery({ ...prayerLogsQuery(), enabled: android });
  const tasks = useQuery({ ...tasksQuery(), enabled: android });
  const userReminders = useQuery({ ...userRemindersQuery(), enabled: android });
  const { fmtTime } = usePreferences();
  const [settings] = useReminderSettings();

  // Ask for notification permission once, since reminders are on by default.
  useEffect(() => {
    if (!android || canNotify()) return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      return;
    }
    requestNotifications();
  }, [android]);

  useEffect(() => {
    if (!android) return;
    const now = Date.now();
    const reminders: Reminder[] = [];

    const config = prayerSettings.data;
    if (
      settings.enabled &&
      modules.includes("spirit") &&
      config?.latitude != null &&
      config.longitude != null
    ) {
      for (let offset = 0; offset < 7; offset++) {
        const date = format(addDays(new Date(), offset), "yyyy-MM-dd");
        const times = prayerTimesFor(
          Number(config.latitude),
          Number(config.longitude),
          config.calc_method,
          config.asr_school,
          date,
        );
        const nextDay = format(addDays(new Date(), offset + 1), "yyyy-MM-dd");
        const nextFajr = prayerTimesFor(
          Number(config.latitude),
          Number(config.longitude),
          config.calc_method,
          config.asr_school,
          nextDay,
        ).fajr;
        const ends = prayerWindowEnds(times as never, nextFajr);
        for (const name of PRAYER_NAMES) {
          const time = times[name] as Date;
          const label = prayerLabel(name, date);
          const logged = (logs.data ?? []).some(
            (log) => log.prayer_date === date && log.prayer_name === name && statusOf(log),
          );
          if (logged) continue;
          // Early reminder (if a lead time is set).
          const early = time.getTime() - settings.leadMinutes * 60_000;
          if (settings.leadMinutes > 0 && early > now) {
            reminders.push({
              id: `${date}-${name}`,
              at: early,
              title: `${label} in ${settings.leadMinutes} minutes`,
              body: `${label} at ${fmtTime(time)}.`,
              path: "/spirit",
              channel: "prayers",
            });
          }
          // At the prayer time itself.
          if ((settings.atTime || settings.leadMinutes === 0) && time.getTime() > now) {
            reminders.push({
              id: `${date}-${name}-now`,
              at: time.getTime(),
              title: `It's time for ${label}`,
              body: `${label} · ${fmtTime(time)}. Tap to log it.`,
              path: "/spirit",
              channel: "prayers",
            });
          }
          // Clutch: the last minutes before this prayer's time runs out.
          const clutch = ends[name].getTime() - 5 * 60_000;
          if (settings.clutch && clutch > now && clutch > time.getTime()) {
            reminders.push({
              id: `${date}-${name}-clutch`,
              at: clutch,
              title: `Clutch time: ${label} isn't logged yet`,
              body:
                name === "fajr"
                  ? `Sunrise is in 5 minutes. Pray ${label} now and log it as Clutch.`
                  : `${label}'s time ends in 5 minutes. Pray it now and log it as Clutch.`,
              path: "/spirit",
              channel: "prayers",
            });
          }
        }
      }
    }

    if (settings.tasksEnabled && modules.includes("do")) {
      reminders.push(
        ...taskReminders({
          tasks: tasks.data ?? [],
          today: todayISO(),
          time: settings.taskTime,
          now,
        }),
      );
    }

    // Tasks with a time ring at that time.
    if (settings.tasksEnabled && modules.includes("do")) {
      reminders.push(...timedTaskReminders({ tasks: tasks.data ?? [], now }));
    }

    // Your own reminders ring whatever the prayer settings are.
    reminders.push(...reminderNotifications(userReminders.data ?? [], now));

    scheduleReminders(reminders);
    // fmtTime changes identity every render; the time format lives in preferences anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [android, prayerSettings.data, logs.data, tasks.data, userReminders.data, settings, modules]);
}

function useNotificationsAllowed() {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    const refresh = () => setAllowed(canNotify());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("life-os-notification-permissions", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("life-os-notification-permissions", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return allowed;
}

function PrayerControls({
  settings,
  update,
}: {
  settings: ReminderSettings;
  update: (patch: Partial<ReminderSettings>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Moon className="size-4" aria-hidden="true" />
            Prayers
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Before each prayer you haven't logged yet. Needs your location in Settings.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          aria-label="Prayer reminders"
        />
      </div>
      {settings.enabled ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="prayer-at-time">Also notify at the prayer time</Label>
          <Switch
            id="prayer-at-time"
            checked={settings.atTime}
            onCheckedChange={(atTime) => update({ atTime })}
          />
        </div>
      ) : null}
      {settings.enabled ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="prayer-clutch" className="block">
            Clutch reminder
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              5 minutes before a prayer's time runs out, if it isn't logged yet.
            </span>
          </Label>
          <Switch
            id="prayer-clutch"
            checked={settings.clutch}
            onCheckedChange={(clutch) => update({ clutch })}
          />
        </div>
      ) : null}
      {settings.enabled ? (
        <div className="space-y-2">
          <Label>Remind me before</Label>
          <Select
            value={String(settings.leadMinutes)}
            onValueChange={(value) => update({ leadMinutes: Number(value) })}
          >
            <SelectTrigger className="h-11 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 5, 10, 15, 30].map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes === 0 ? "No early reminder" : `${minutes} minutes before`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

function TaskControls({
  settings,
  update,
}: {
  settings: ReminderSettings;
  update: (patch: Partial<ReminderSettings>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4" aria-hidden="true" />
            Tasks
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            One notification a day with what's due, including anything overdue.
          </p>
        </div>
        <Switch
          checked={settings.tasksEnabled}
          onCheckedChange={(tasksEnabled) => update({ tasksEnabled })}
          aria-label="Task reminders"
        />
      </div>
      {settings.tasksEnabled ? (
        <div className="space-y-2">
          <Label htmlFor="task-reminder-time">At</Label>
          <Input
            id="task-reminder-time"
            type="time"
            className="h-11 w-36 tabular-nums"
            value={settings.taskTime}
            onChange={(event) => event.target.value && update({ taskTime: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Settings page: prayer and task reminders together. */
export function ReminderSettingsCard() {
  const [settings, update] = useReminderSettings();
  const allowed = useNotificationsAllowed();
  const android = isAndroidApp();
  const on = settings.enabled || settings.tasksEnabled;
  return (
    <section className="stat-card space-y-5 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          {on ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          Reminders
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {android
            ? "Notifications on this phone. They keep working when the app is closed."
            : "Reminders arrive as notifications in the Life OS Android app. Set them there."}
        </p>
      </div>
      {android ? (
        <>
          {!allowed ? (
            <div className="tone-warning flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>Notifications are off for Life OS, so reminders can't show.</span>
              <Button type="button" size="sm" onClick={requestNotifications}>
                Allow notifications
              </Button>
            </div>
          ) : null}
          <PrayerControls settings={settings} update={update} />
          <div className="border-t border-border" />
          <TaskControls settings={settings} update={update} />
        </>
      ) : null}
    </section>
  );
}

/** Spirit page: just the prayer part. */
export function PrayerReminderSettings() {
  const [settings, update] = useReminderSettings();
  const allowed = useNotificationsAllowed();
  if (!isAndroidApp()) {
    return (
      <section className="stat-card p-5 text-sm text-muted-foreground">
        Prayer reminders arrive as notifications in the Life OS Android app.
      </section>
    );
  }
  return (
    <section className="stat-card space-y-4 p-5">
      {!allowed ? (
        <div className="tone-warning flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
          <span>Notifications are off for Life OS.</span>
          <Button type="button" size="sm" onClick={requestNotifications}>
            Allow notifications
          </Button>
        </div>
      ) : null}
      <PrayerControls settings={settings} update={update} />
    </section>
  );
}
