/**
 * Bridge to the Android shell (mobile/android MainActivity, "LifeOSNative").
 * Every function is a no-op on the website, so callers never need to check.
 */

type NativeBridge = {
  canNotify(): boolean;
  requestNotifications(): void;
  scheduleReminders(json: string): void;
  readHealth?(json: string): void;
  healthStatus?(): string;
  requestHealth?(): void;
  openHealthSettings?(which: string): void;
  showTimer?(title: string, startedAt: number): void;
  saveFile?(name: string, base64: string, mime: string): string;
  setWidgetData?(json: string): void;
  takePendingPrayerLogs?(): string;
};

declare global {
  interface Window {
    LifeOSNative?: NativeBridge;
    /** Called by the Android shell with results of async requests. */
    __lifeOSNativeCallback?: (id: string, payload: string) => void;
  }
}

function bridge(): NativeBridge | null {
  return typeof window !== "undefined" ? (window.LifeOSNative ?? null) : null;
}

export function isAndroidApp(): boolean {
  return bridge() !== null;
}

export function canNotify(): boolean {
  try {
    return bridge()?.canNotify() ?? false;
  } catch {
    return false;
  }
}

export function requestNotifications(): void {
  bridge()?.requestNotifications();
}

export type Reminder = {
  /** Stable id, so rescheduling replaces rather than duplicates. */
  id: string;
  /** Epoch milliseconds. */
  at: number;
  title: string;
  body: string;
  /** App path opened when the notification is tapped. */
  path: string;
  /** Android notification channel: "prayers" (default) or "tasks". */
  channel?: "prayers" | "tasks";
  /** Prayer reminders: buttons that log the prayer straight from the notification. */
  prayer?: { date: string; name: string; actions: string[] };
};

/** Replaces every scheduled reminder with this list. */
export function scheduleReminders(reminders: Reminder[]): void {
  bridge()?.scheduleReminders(JSON.stringify(reminders));
}

/** Sends a request to the shell and waits for its callback. */
export function nativeRequest(
  method: "readHealth",
  args: Record<string, unknown>,
  timeoutMs = 120_000,
): Promise<string> {
  const native = bridge();
  const fn = native?.[method];
  if (!native || !fn) return Promise.reject(new Error("Only available in the Android app."));
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("The phone didn't answer in time."));
    }, timeoutMs);
    pending.set(id, (payload) => {
      window.clearTimeout(timer);
      resolve(payload);
    });
    ensureCallback();
    fn.call(native, JSON.stringify({ id, ...args }));
  });
}

const pending = new Map<string, (payload: string) => void>();
function ensureCallback() {
  if (window.__lifeOSNativeCallback) return;
  window.__lifeOSNativeCallback = (id, payload) => {
    pending.get(id)?.(payload);
    pending.delete(id);
  };
}

export type HealthStatus = "unavailable" | "unsupported" | "needs_permission" | "ready";

/** Whether Samsung Health (via Health Connect) can be read on this device. */
export function healthStatus(): HealthStatus {
  try {
    const value = bridge()?.healthStatus?.();
    return value === "unsupported" || value === "needs_permission" || value === "ready"
      ? value
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function requestHealthAccess(): void {
  bridge()?.requestHealth?.();
}

/** Opens Health Connect: its main screen, or the page with Life OS's permissions. */
export function openHealthSettings(which: "home" | "app"): void {
  bridge()?.openHealthSettings?.(which);
}

/** Shows (or, with null, clears) the phone's ongoing "timer running" notification. */
export function showTimerNotice(timer: { title: string; startedAt: number } | null): void {
  bridge()?.showTimer?.(timer?.title ?? "", timer?.startedAt ?? 0);
}

/**
 * Saves a file the app made (an export). In the Android app it goes to
 * Downloads through the shell, since a WebView can't save downloads itself;
 * on the website it is an ordinary download. Returns where it went, or null.
 */
export function saveFile(name: string, bytes: Uint8Array, mime: string): string | null {
  const native = bridge();
  if (native?.saveFile) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    try {
      return native.saveFile(name, btoa(binary), mime) || null;
    } catch {
      return null;
    }
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "your downloads";
}

/** Hands the home-screen prayer widget what to show. */
export function setWidgetData(payload: unknown): void {
  try {
    bridge()?.setWidgetData?.(JSON.stringify(payload));
  } catch {
    // Older app without widgets.
  }
}

export type PendingPrayerLog = { date: string; name: string; status: string; at: number };

/** Prayers logged from notification buttons while the app was closed; taking them clears them. */
export function takePendingPrayerLogs(): PendingPrayerLog[] {
  try {
    const raw = bridge()?.takePendingPrayerLogs?.();
    return raw ? (JSON.parse(raw) as PendingPrayerLog[]) : [];
  } catch {
    return [];
  }
}
