/**
 * Google Calendar ⇄ Life OS event mapping. Pure functions, no I/O.
 *
 * All-day events: Google gives a date (end date exclusive); Life OS stores
 * times, so an all-day event becomes local midnight → 23:59 of the last day
 * in the calendar's time zone, and goes back to Google as dates.
 */
import type { GoogleEvent, GoogleEventBody, LifeEventFields, LifeEventRow } from "./types";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Milliseconds the zone is ahead of UTC at instant `ms`. */
export function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wall - Math.floor(ms / 1000) * 1000;
}

/** The instant a wall-clock time on `date` (YYYY-MM-DD) happens in `timeZone`. */
export function zonedToIso(date: string, hour: number, minute: number, timeZone: string): string {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Not a date: ${date}`);
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
  let ms = guess - zoneOffsetMs(guess, timeZone);
  // Second pass settles DST edges where the first guess crossed the change.
  ms = guess - zoneOffsetMs(ms, timeZone);
  return new Date(ms).toISOString();
}

/** The calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function dateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function addDaysToDate(date: string, days: number): string {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Not a date: ${date}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

export function isAllDay(event: GoogleEvent): boolean {
  return !!event.start?.date && !event.start?.dateTime;
}

/** A Google event as Life OS fields. `timeZone` is the calendar's zone. */
export function googleToLife(event: GoogleEvent, timeZone: string): LifeEventFields {
  const title = (event.summary ?? "").trim() || "(No title)";
  const description = event.description?.trim() ? event.description : null;
  if (isAllDay(event)) {
    const startDate = event.start!.date!;
    const endExclusive = event.end?.date ?? addDaysToDate(startDate, 1);
    const lastDay = endExclusive > startDate ? addDaysToDate(endExclusive, -1) : startDate;
    const zone = event.start?.timeZone ?? timeZone;
    return {
      title,
      description,
      start_at: zonedToIso(startDate, 0, 0, zone),
      end_at: zonedToIso(lastDay, 23, 59, zone),
    };
  }
  const start = new Date(event.start?.dateTime ?? "").toISOString();
  const endRaw = event.end?.dateTime;
  const end = endRaw ? new Date(endRaw).toISOString() : null;
  return { title, description, start_at: start, end_at: end && end >= start ? end : null };
}

const HOUR_MS = 60 * 60 * 1000;

/** A Life OS event as a Google insert/patch body. */
export function lifeToGoogle(
  event: Pick<LifeEventRow, "title" | "description" | "start_at" | "end_at">,
  opts: { allDay: boolean; timeZone: string },
): GoogleEventBody {
  const base = { summary: event.title, description: event.description ?? "" };
  if (opts.allDay) {
    const startDate = dateInZone(event.start_at, opts.timeZone);
    const lastDay = event.end_at ? dateInZone(event.end_at, opts.timeZone) : startDate;
    return {
      ...base,
      start: { date: startDate },
      end: { date: addDaysToDate(lastDay < startDate ? startDate : lastDay, 1) },
    };
  }
  const startMs = Date.parse(event.start_at);
  const endMs = event.end_at ? Date.parse(event.end_at) : startMs + HOUR_MS;
  return {
    ...base,
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(Math.max(endMs, startMs)).toISOString() },
  };
}

/**
 * The conflict rule when both sides changed since the last sync: the most
 * recent edit wins; a tie goes to Google.
 */
export function newestWins(
  lifeUpdatedAt: string,
  googleUpdated: string | undefined,
): "life" | "google" {
  if (!googleUpdated) return "life";
  return Date.parse(lifeUpdatedAt) > Date.parse(googleUpdated) ? "life" : "google";
}
