/** Shapes shared by the sync engine, the real Google client and the tests. */

export type GoogleTime = { date?: string; dateTime?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  etag?: string;
  updated?: string;
  summary?: string;
  description?: string;
  start?: GoogleTime;
  end?: GoogleTime;
};

export type GoogleEventBody = {
  summary: string;
  description: string;
  start: GoogleTime;
  end: GoogleTime;
};

export type GoogleEventPage = {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  timeZone?: string;
};

export type GoogleCalendarEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  timeZone?: string;
};

/** Thrown by a Google client for any non-2xx answer. */
export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/** The calls the engine makes. The real one is HTTP; tests pass a fake. */
export interface GoogleCalendarApi {
  listEvents(
    calendarId: string,
    query: {
      syncToken?: string | undefined;
      timeMin?: string | undefined;
      pageToken?: string | undefined;
    },
  ): Promise<GoogleEventPage>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
  insertEvent(calendarId: string, body: GoogleEventBody): Promise<GoogleEvent>;
  /** `etag` makes it conditional (If-Match); a 412 means Google changed it. */
  patchEvent(
    calendarId: string,
    eventId: string,
    body: GoogleEventBody,
    etag?: string,
  ): Promise<GoogleEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

export type LifeEventFields = {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
};

export type LifeEventRow = LifeEventFields & { id: string; updated_at: string };

export type EventLink = {
  id: string;
  event_id: string | null;
  calendar_id: string;
  google_event_id: string;
  etag: string | null;
  google_updated_at: string | null;
  lifeos_synced_at: string | null;
  all_day: boolean;
  origin: "google" | "lifeos";
};

export type NewEventLink = Omit<EventLink, "id">;

/** The Life OS side. The real one is Supabase under the user's own token. */
export interface SyncStore {
  listLinks(calendarId: string): Promise<EventLink[]>;
  getEvents(ids: string[]): Promise<LifeEventRow[]>;
  /** Events with no link to any calendar, starting at or after `sinceIso`. */
  listUnlinkedEvents(sinceIso: string): Promise<LifeEventRow[]>;
  createEvent(fields: LifeEventFields): Promise<LifeEventRow>;
  updateEvent(id: string, fields: LifeEventFields): Promise<LifeEventRow>;
  deleteEvent(id: string): Promise<void>;
  insertLink(link: NewEventLink): Promise<EventLink>;
  updateLink(id: string, patch: Partial<NewEventLink>): Promise<void>;
  deleteLink(id: string): Promise<void>;
}

export type SyncResult = {
  syncToken: string | null;
  imported: number;
  updatedHere: number;
  removedHere: number;
  sentToGoogle: number;
  removedFromGoogle: number;
};
