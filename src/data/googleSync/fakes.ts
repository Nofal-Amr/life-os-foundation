/** In-memory Google and Life OS for the sync engine's tests. */
import {
  GoogleApiError,
  type EventLink,
  type GoogleCalendarApi,
  type GoogleEvent,
  type GoogleEventBody,
  type LifeEventFields,
  type LifeEventRow,
  type NewEventLink,
  type SyncStore,
} from "./types";

export class Clock {
  constructor(public ms: number) {}
  tick(minutes = 1) {
    this.ms += minutes * 60_000;
    return new Date(this.ms).toISOString();
  }
  get iso() {
    return new Date(this.ms).toISOString();
  }
}

export class FakeGoogle implements GoogleCalendarApi {
  events = new Map<string, GoogleEvent>();
  /** Ids changed since each issued token. */
  private changes: string[] = [];
  private tokens = new Map<string, number>();
  private seq = 0;
  expireTokens = false;
  calls: string[] = [];
  pageSize = 2;

  constructor(
    private clock: Clock,
    public timeZone = "Africa/Cairo",
  ) {}

  /** Google-side edit, as if made in Google's own app. */
  put(event: Omit<GoogleEvent, "etag" | "updated">) {
    const next: GoogleEvent = { ...event, etag: `"e${++this.seq}"`, updated: this.clock.tick() };
    this.events.set(event.id, next);
    this.changes.push(event.id);
    return next;
  }

  cancel(id: string) {
    const prev = this.events.get(id);
    if (!prev) throw new Error("no such event");
    this.put({ ...prev, status: "cancelled" });
  }

  async listEvents(
    _calendarId: string,
    query: { syncToken?: string | undefined; timeMin?: string | undefined; pageToken?: string | undefined },
  ) {
    this.calls.push(query.syncToken ? "list:incremental" : "list:full");
    let ids: string[];
    if (query.syncToken) {
      if (this.expireTokens || !this.tokens.has(query.syncToken)) {
        throw new GoogleApiError(410, "Sync token is no longer valid");
      }
      ids = [...new Set(this.changes.slice(this.tokens.get(query.syncToken)))];
    } else {
      ids = [...this.events.values()]
        .filter((e) => e.status !== "cancelled")
        .filter((e) => {
          const at = e.end?.dateTime ?? e.end?.date ?? e.start?.dateTime ?? "";
          return !query.timeMin || at >= query.timeMin.slice(0, at.length);
        })
        .map((e) => e.id);
    }
    const offset = Number(query.pageToken ?? 0);
    const items = ids.slice(offset, offset + this.pageSize).map((id) => this.events.get(id)!);
    const more = offset + this.pageSize < ids.length;
    const token = `t${this.tokens.size + 1}`;
    if (!more) this.tokens.set(token, this.changes.length);
    return {
      items,
      timeZone: this.timeZone,
      ...(more ? { nextPageToken: String(offset + this.pageSize) } : { nextSyncToken: token }),
    };
  }

  async getEvent(_calendarId: string, eventId: string) {
    const e = this.events.get(eventId);
    if (!e) throw new GoogleApiError(404, "Not found");
    return e;
  }

  async insertEvent(_calendarId: string, body: GoogleEventBody) {
    this.calls.push("insert");
    const id = `g${++this.seq}`;
    return this.put({ id, status: "confirmed", ...body });
  }

  async patchEvent(_calendarId: string, eventId: string, body: GoogleEventBody, etag?: string) {
    this.calls.push("patch");
    const prev = this.events.get(eventId);
    if (!prev) throw new GoogleApiError(404, "Not found");
    if (etag && etag !== prev.etag) throw new GoogleApiError(412, "Precondition Failed");
    return this.put({ ...prev, ...body });
  }

  async deleteEvent(_calendarId: string, eventId: string) {
    this.calls.push("delete");
    if (!this.events.has(eventId)) throw new GoogleApiError(410, "Gone");
    this.cancel(eventId);
  }
}

export class MemoryStore implements SyncStore {
  events = new Map<string, LifeEventRow>();
  links = new Map<string, EventLink>();
  private seq = 0;

  constructor(private clock: Clock) {}

  /** A Life OS edit, as if made on the Calendar page. */
  add(fields: LifeEventFields) {
    const row = { ...fields, id: `l${++this.seq}`, updated_at: this.clock.tick() };
    this.events.set(row.id, row);
    return row;
  }
  edit(id: string, patch: Partial<LifeEventFields>) {
    const row = { ...this.events.get(id)!, ...patch, updated_at: this.clock.tick() };
    this.events.set(id, row);
    return row;
  }
  remove(id: string) {
    this.events.delete(id);
    for (const l of this.links.values()) if (l.event_id === id) l.event_id = null; // ON DELETE SET NULL
  }

  async listLinks(calendarId: string) {
    return [...this.links.values()].filter((l) => l.calendar_id === calendarId).map((l) => ({ ...l }));
  }
  async getEvents(ids: string[]) {
    return ids.flatMap((id) => (this.events.has(id) ? [this.events.get(id)!] : []));
  }
  async listUnlinkedEvents(sinceIso: string) {
    const linked = new Set([...this.links.values()].map((l) => l.event_id));
    return [...this.events.values()].filter((e) => !linked.has(e.id) && e.start_at >= sinceIso);
  }
  async createEvent(fields: LifeEventFields) {
    return this.add(fields);
  }
  async updateEvent(id: string, fields: LifeEventFields) {
    return this.edit(id, fields);
  }
  async deleteEvent(id: string) {
    this.remove(id);
  }
  async insertLink(link: NewEventLink) {
    const row = { ...link, id: `k${++this.seq}` };
    this.links.set(row.id, row);
    return { ...row };
  }
  async updateLink(id: string, patch: Partial<NewEventLink>) {
    const prev = this.links.get(id);
    if (prev) this.links.set(id, { ...prev, ...patch });
  }
  async deleteLink(id: string) {
    this.links.delete(id);
  }
}
