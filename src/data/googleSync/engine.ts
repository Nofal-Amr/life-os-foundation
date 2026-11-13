/**
 * Two-way sync of one Google calendar with Life OS events.
 *
 * 1. Pull what changed in Google (incremental with a sync token; a full pull
 *    from 30 days ago the first time or when Google says the token expired).
 * 2. Apply it here: new → create, cancelled → delete, changed → update unless
 *    the Life OS copy was edited more recently (newest edit wins, tie → Google).
 * 3. Push (only when the calendar is writable): Life OS edits, Life OS
 *    deletions, and — for the calendar chosen for new events — events made in
 *    Life OS that aren't linked yet.
 *
 * Google and the database are injected, so this file does no I/O itself.
 */
import { googleToLife, isAllDay, lifeToGoogle, newestWins } from "./mapping";
import {
  GoogleApiError,
  type EventLink,
  type GoogleCalendarApi,
  type GoogleEvent,
  type LifeEventRow,
  type SyncResult,
  type SyncStore,
} from "./types";

export const PULL_WINDOW_DAYS = 30;

export type SyncCalendarInput = {
  calendarId: string;
  /** Owner/writer access: Life OS edits and deletions go back to Google. */
  canWrite: boolean;
  /** This is the calendar new Life OS events go to. */
  pushNew: boolean;
  syncToken: string | null;
  /** The calendar's zone, used for all-day events if Google doesn't send one. */
  timeZone: string;
  now: Date;
  google: GoogleCalendarApi;
  store: SyncStore;
};

const isLater = (a: string, b: string | null) => !b || Date.parse(a) > Date.parse(b);

async function pullAll(
  input: SyncCalendarInput,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string | null; timeZone: string }> {
  const timeMin = new Date(input.now.getTime() - PULL_WINDOW_DAYS * 86_400_000).toISOString();
  const run = async (syncToken: string | null) => {
    const items: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;
    let timeZone = input.timeZone;
    do {
      const page = await input.google.listEvents(
        input.calendarId,
        syncToken ? { syncToken, pageToken } : { timeMin, pageToken },
      );
      items.push(...page.items);
      if (page.timeZone) timeZone = page.timeZone;
      pageToken = page.nextPageToken;
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    } while (pageToken);
    return { items, nextSyncToken, timeZone };
  };
  if (!input.syncToken) return run(null);
  try {
    return await run(input.syncToken);
  } catch (error) {
    // 410 Gone: the sync token expired. Start again with a full pull.
    if (error instanceof GoogleApiError && error.status === 410) return run(null);
    throw error;
  }
}

export async function syncCalendar(input: SyncCalendarInput): Promise<SyncResult> {
  const { calendarId, google, store } = input;
  const result: SyncResult = {
    syncToken: null,
    imported: 0,
    updatedHere: 0,
    removedHere: 0,
    sentToGoogle: 0,
    removedFromGoogle: 0,
  };

  const links = await store.listLinks(calendarId);
  const byGoogleId = new Map(links.map((l) => [l.google_event_id, l]));
  const linkedIds = links.flatMap((l) => (l.event_id ? [l.event_id] : []));
  const events = new Map((await store.getEvents(linkedIds)).map((e) => [e.id, e]));
  /** Links already settled in this run, so the push step leaves them alone. */
  const settled = new Set<string>();

  const pulled = await pullAll(input);
  result.syncToken = pulled.nextSyncToken;
  const zone = pulled.timeZone;

  const takeGoogle = async (link: EventLink, item: GoogleEvent) => {
    const fields = googleToLife(item, zone);
    const existing = link.event_id ? events.get(link.event_id) : undefined;
    const row = existing
      ? await store.updateEvent(existing.id, fields)
      : await store.createEvent(fields);
    events.set(row.id, row);
    const patch = {
      event_id: row.id,
      etag: item.etag ?? null,
      google_updated_at: item.updated ?? null,
      lifeos_synced_at: row.updated_at,
      all_day: isAllDay(item),
    };
    await store.updateLink(link.id, patch);
    Object.assign(link, patch);
    settled.add(link.id);
    result.updatedHere += 1;
  };

  // 2. Apply Google's changes here.
  for (const item of pulled.items) {
    const link = byGoogleId.get(item.id);
    if (item.status === "cancelled") {
      if (link) {
        if (link.event_id) {
          await store.deleteEvent(link.event_id);
          events.delete(link.event_id);
          result.removedHere += 1;
        }
        await store.deleteLink(link.id);
        byGoogleId.delete(item.id);
      }
      continue;
    }
    if (!link) {
      const row = await store.createEvent(googleToLife(item, zone));
      events.set(row.id, row);
      const created = await store.insertLink({
        event_id: row.id,
        calendar_id: calendarId,
        google_event_id: item.id,
        etag: item.etag ?? null,
        google_updated_at: item.updated ?? null,
        lifeos_synced_at: row.updated_at,
        all_day: isAllDay(item),
        origin: "google",
      });
      byGoogleId.set(item.id, created);
      settled.add(created.id);
      result.imported += 1;
      continue;
    }
    if (link.etag && link.etag === item.etag) continue; // our own push coming back
    const event = link.event_id ? events.get(link.event_id) : undefined;
    if (!event) {
      // Deleted in Life OS. On a writable calendar the push step deletes it in
      // Google; on a read-only one Google's copy comes back.
      if (!input.canWrite) await takeGoogle(link, item);
      continue;
    }
    const lifeChanged = isLater(event.updated_at, link.lifeos_synced_at);
    if (input.canWrite && lifeChanged && newestWins(event.updated_at, item.updated) === "life") {
      // Life OS wins; remember Google's latest etag so the push isn't refused.
      link.etag = item.etag ?? link.etag;
      continue;
    }
    await takeGoogle(link, item);
  }

  if (!input.canWrite) return result;

  // 3. Push Life OS changes to Google.
  for (const link of [...byGoogleId.values()]) {
    if (settled.has(link.id)) continue;
    if (!link.event_id || !events.has(link.event_id)) {
      try {
        await google.deleteEvent(calendarId, link.google_event_id);
      } catch (error) {
        const gone = error instanceof GoogleApiError && (error.status === 404 || error.status === 410);
        if (!gone) throw error;
      }
      await store.deleteLink(link.id);
      result.removedFromGoogle += 1;
      continue;
    }
    const event = events.get(link.event_id)!;
    if (!isLater(event.updated_at, link.lifeos_synced_at)) continue;
    await pushEdit(link, event);
  }

  async function pushEdit(link: EventLink, event: LifeEventRow) {
    const body = lifeToGoogle(event, { allDay: link.all_day, timeZone: zone });
    let sent: GoogleEvent;
    try {
      sent = await google.patchEvent(calendarId, link.google_event_id, body, link.etag ?? undefined);
    } catch (error) {
      if (!(error instanceof GoogleApiError && error.status === 412)) throw error;
      // Google changed it since we last looked: apply the rule once more.
      const latest = await google.getEvent(calendarId, link.google_event_id);
      if (newestWins(event.updated_at, latest.updated) === "google") {
        await takeGoogle(link, latest);
        return;
      }
      sent = await google.patchEvent(calendarId, link.google_event_id, body, latest.etag);
    }
    await store.updateLink(link.id, {
      etag: sent.etag ?? null,
      google_updated_at: sent.updated ?? null,
      lifeos_synced_at: event.updated_at,
    });
    result.sentToGoogle += 1;
  }

  if (input.pushNew) {
    const since = new Date(input.now.getTime() - PULL_WINDOW_DAYS * 86_400_000).toISOString();
    for (const event of await store.listUnlinkedEvents(since)) {
      const sent = await google.insertEvent(
        calendarId,
        lifeToGoogle(event, { allDay: false, timeZone: zone }),
      );
      await store.insertLink({
        event_id: event.id,
        calendar_id: calendarId,
        google_event_id: sent.id,
        etag: sent.etag ?? null,
        google_updated_at: sent.updated ?? null,
        lifeos_synced_at: event.updated_at,
        all_day: false,
        origin: "lifeos",
      });
      result.sentToGoogle += 1;
    }
  }

  return result;
}
