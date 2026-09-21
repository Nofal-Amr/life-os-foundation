/**
 * Private usage analytics: which screens and actions get used, and how long
 * screens stay open. Events go only to the user's own ux_events rows (RLS),
 * never to a third party, and can be switched off in Settings.
 */
import { supabase } from "@/integrations/supabase/client";
import { isAndroidApp } from "@/lib/native";

const OFF_KEY = "life-os-analytics-off";
type Event = {
  name: string;
  path: string | null;
  platform: string;
  props: Record<string, unknown> | null;
  created_at: string;
};

let queue: Event[] = [];
let timer: number | null = null;
let disabledForSession = false;

export function analyticsEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return false;
  }
}

export function setAnalyticsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch {
    // Storage blocked: nothing is recorded anyway.
  }
  if (!on) queue = [];
}

export function track(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || disabledForSession || !analyticsEnabled()) return;
  queue.push({
    name,
    path: window.location.pathname,
    platform: isAndroidApp() ? "android" : "web",
    props: props ?? null,
    created_at: new Date().toISOString(),
  });
  timer ??= window.setTimeout(flush, 5000);
}

async function flush() {
  timer = null;
  if (!queue.length || !navigator.onLine) return;
  const batch = queue;
  queue = [];
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase
    .from("ux_events")
    .insert(batch.map((event) => ({ ...event, props: event.props as never })));
  // Table missing (migration not run): stop trying this session.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) disabledForSession = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flush());
}

/** Screen views with time on screen, called on every route change. */
let current: { path: string; since: number } | null = null;
export function trackScreen(path: string) {
  const now = Date.now();
  if (current && current.path !== path) {
    track("screen_time", {
      screen: current.path,
      seconds: Math.round((now - current.since) / 1000),
    });
  }
  if (!current || current.path !== path) {
    track("screen", { screen: path });
    current = { path, since: now };
  }
}
