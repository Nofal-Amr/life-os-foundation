/**
 * Focus sessions: a timer with a planned length, and optionally a habit to
 * tick when it finishes. The time itself is an ordinary time entry; this only
 * remembers the plan, on this device, while the session runs.
 */

export type FocusSession = {
  /** Epoch ms when the session started. */
  startedAt: number;
  minutes: number;
  habitId?: string | null;
  habitName?: string | null;
};

const KEY = "life-os-focus";

export const FOCUS_PRESETS = [15, 25, 50] as const;

export function readFocus(): FocusSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as FocusSession;
    return Number.isFinite(value.startedAt) && value.minutes > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeFocus(session: FocusSession | null) {
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("life-os-focus"));
  } catch {
    // Private mode: the session still runs as a plain timer.
  }
}

/** Whether a focus plan belongs to the timer that is running (started within a minute of it). */
export function focusMatches(
  session: FocusSession | null,
  runningStartedAt: string | null,
): boolean {
  if (!session || !runningStartedAt) return false;
  return Math.abs(new Date(runningStartedAt).getTime() - session.startedAt) < 60_000;
}

/** Milliseconds left, never below zero. */
export function focusRemaining(session: FocusSession, now: number): number {
  return Math.max(0, session.startedAt + session.minutes * 60_000 - now);
}

/** When the session ends, as an ISO string (for the time entry's end). */
export function focusEndISO(session: FocusSession): string {
  return new Date(session.startedAt + session.minutes * 60_000).toISOString();
}

/** A short, soft two-note chime. Silent where audio isn't allowed. */
export function playChime() {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = context.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.65);
    });
    window.setTimeout(() => void context.close(), 1200);
  } catch {
    // No sound; the notice still shows.
  }
}
