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
  setTodayWidget?(json: string): void;
  takePendingPrayerLogs?(): string;
  listen?(json: string): void;
  focusLock?(on: boolean): void;
  startCompass?(latitude: number, longitude: number, mode: string): boolean;
  setCompassMode?(mode: string): void;
  compassDeclination?(): number;
  stopCompass?(): void;
  setConnect?(json: string): boolean;
  requestConnectPermissions?(): void;
  connectStatus?(): string;
  connectTest?(): void;
  openBatterySettings?(): void;
  openFullScreenSettings?(): void;
  buildFeatures?(): string;
  spendingStatus?(): string;
  setSpendingWatch?(json: string): void;
  openNotificationAccess?(): void;
  pendingSpending?(): string;
  resolveSpending?(id: string, status: string): void;
};

declare global {
  interface Window {
    LifeOSNative?: NativeBridge;
    /** Called by the Android shell with results of async requests. */
    __lifeOSNativeCallback?: (id: string, payload: string) => void;
    /** Native compass readings (see mobile/android Compass.java). */
    __lifeOSCompass?: (
      heading: number,
      accuracy: number,
      calibration: number,
      upright: boolean,
    ) => void;
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
  method: "readHealth" | "listen",
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

/** name is a prayer, or "azkar_morning" / "azkar_evening" (status "read"). */
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

/* ------------------------------------------------------------- compass */

/** A true-north compass from the Android app; null on the website. */
export const nativeCompass = {
  available(): boolean {
    return typeof bridge()?.startCompass === "function";
  },
  start(latitude: number, longitude: number, mode: string): boolean {
    try {
      return bridge()?.startCompass?.(latitude, longitude, mode) ?? false;
    } catch {
      return false;
    }
  },
  setMode(mode: string): void {
    bridge()?.setCompassMode?.(mode);
  },
  declination(): number {
    return bridge()?.compassDeclination?.() ?? 0;
  },
  stop(): void {
    bridge()?.stopCompass?.();
  },
};

/* -------------------------------------------------------- life connect */

export type ConnectRole = "off" | "sim" | "main";

export type ConnectStatus = {
  role: ConnectRole;
  connected: boolean;
  phone: boolean;
  callLog: boolean;
  answer: boolean;
  contacts: boolean;
  notifications: boolean;
  battery: boolean;
  /** SIM phone: can read incoming SMS and send replies. */
  sms: boolean;
  /** Main phone: the call screen may show over the lock screen. */
  fullScreen: boolean;
};

/** Life Connect in the Android app; every call is a no-op on the website. */
export const lifeConnect = {
  available(): boolean {
    return typeof bridge()?.setConnect === "function";
  },
  configure(settings: {
    role: ConnectRole;
    secret: string | null;
    url: string;
    anonKey: string;
    device: string;
    /** SIM phone: forward SMS, and whether to include one-time codes. */
    sms: boolean;
    codes: boolean;
  }): boolean {
    try {
      return bridge()?.setConnect?.(JSON.stringify(settings)) ?? false;
    } catch {
      return false;
    }
  },
  requestPermissions(): void {
    bridge()?.requestConnectPermissions?.();
  },
  status(): ConnectStatus | null {
    try {
      const raw = bridge()?.connectStatus?.();
      return raw ? (JSON.parse(raw) as ConnectStatus) : null;
    } catch {
      return null;
    }
  },
  test(): void {
    bridge()?.connectTest?.();
  },
  openFullScreenSettings(): void {
    bridge()?.openFullScreenSettings?.();
  },
  openBatterySettings(): void {
    bridge()?.openBatterySettings?.();
  },
};

/* ------------------------------------------ spending from notifications */

export type SpendingWatch = { packages: string[]; senders: string[] };
export type SpendingStatus = {
  access: boolean;
  watch: SpendingWatch;
  /** Apps seen posting notifications: package → name. */
  seen: Record<string, string>;
};
export type PendingSpend = {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  source: string;
  at: number;
  /** "new" = not answered yet; "log" = you said yes. */
  status: "new" | "log";
};

export const spendingInbox = {
  available(): boolean {
    return typeof bridge()?.spendingStatus === "function";
  },
  status(): SpendingStatus | null {
    try {
      const raw = bridge()?.spendingStatus?.();
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<SpendingStatus>;
      return {
        access: !!value.access,
        watch: { packages: value.watch?.packages ?? [], senders: value.watch?.senders ?? [] },
        seen: value.seen ?? {},
      };
    } catch {
      return null;
    }
  },
  setWatch(watch: SpendingWatch): void {
    bridge()?.setSpendingWatch?.(JSON.stringify(watch));
  },
  openAccess(): void {
    bridge()?.openNotificationAccess?.();
  },
  pending(): PendingSpend[] {
    try {
      return JSON.parse(bridge()?.pendingSpending?.() ?? "[]") as PendingSpend[];
    } catch {
      return [];
    }
  },
  resolve(id: string, status: "log" | "dismiss" | "done"): void {
    bridge()?.resolveSpending?.(id, status);
  },
};

/** Optional parts of the Android build: SMS forwarding and spending from notifications are Full-build only. */
export function buildFeatures(): { sms: boolean; spending: boolean } {
  try {
    const raw = bridge()?.buildFeatures?.();
    if (!raw) return { sms: true, spending: true };
    const value = JSON.parse(raw) as { sms?: boolean; spending?: boolean };
    return { sms: !!value.sms, spending: !!value.spending };
  } catch {
    return { sms: false, spending: false };
  }
}

/* ------------------------------------------------ voice and focus lock */

type SpeechResultList = { 0: { transcript: string } }[];
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
};

/** Whether speech-to-text is available here (the app, or a browser that has it). */
export function canListen(): boolean {
  if (typeof bridge()?.listen === "function") return true;
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]);
}

/**
 * Speech to text: the phone's recogniser in the app, the browser's on the web.
 * Resolves with the words, or "" if nothing was said.
 */
export async function listen(lang?: string): Promise<string> {
  if (typeof bridge()?.listen === "function") {
    return nativeRequest("listen", { lang: lang ?? "" }, 60_000);
  }
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Recognition = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
  if (!Recognition) throw new Error("Voice input isn't available here.");
  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = lang || navigator.language;
    recognition.interimResults = false;
    let text = "";
    recognition.onresult = (event) => {
      text = event.results[0]?.[0]?.transcript ?? "";
    };
    recognition.onerror = () => resolve(text);
    recognition.onend = () => resolve(text);
    recognition.start();
  });
}

/** Pins the screen to Life OS during focus (Android app pinning); no-op elsewhere. */
export function focusLock(on: boolean): void {
  try {
    bridge()?.focusLock?.(on);
  } catch {
    // Not available.
  }
}

/** Hands the Today widget its figures (already formatted text). */
export function setTodayWidget(data: { left: string; spent: string; tasks: string }): void {
  try {
    bridge()?.setTodayWidget?.(JSON.stringify(data));
  } catch {
    // No widget here.
  }
}
