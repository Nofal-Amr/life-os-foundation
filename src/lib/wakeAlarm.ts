/**
 * Wake-up alarms before a prayer, set in the phone's own Clock app (owner's
 * decision: mainly to wake for Fajr; not the adhan and not a reminder).
 * Settings live on this device, because the alarm is on this phone.
 */
export type WakePrayer = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export type WakeSettings = { minutes: number; each: Partial<Record<WakePrayer, number>> };

export const DEFAULT_WAKE: WakeSettings = { minutes: 10, each: {} };
export const WAKE_MAX_MINUTES = 60;

const KEY = "life-os-wake-alarm";

export function readWake(): WakeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<WakeSettings>;
    return { minutes: saved.minutes ?? DEFAULT_WAKE.minutes, each: saved.each ?? {} };
  } catch {
    return DEFAULT_WAKE;
  }
}

export function writeWake(settings: WakeSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered; the default stays.
  }
}

/** How many minutes before this prayer the alarm rings. */
export function minutesBefore(settings: WakeSettings, prayer: WakePrayer): number {
  return settings.each[prayer] ?? settings.minutes;
}

/**
 * When the alarm should ring: N minutes before today's time, or before
 * tomorrow's once that has passed. Date arithmetic takes care of crossing
 * midnight.
 */
export function wakeAlarmAt(
  now: Date,
  today: Date,
  tomorrow: Date,
  minutes: number,
): { at: Date; tomorrow: boolean } {
  const before = (time: Date) => new Date(time.getTime() - minutes * 60_000);
  const first = before(today);
  return first > now ? { at: first, tomorrow: false } : { at: before(tomorrow), tomorrow: true };
}
