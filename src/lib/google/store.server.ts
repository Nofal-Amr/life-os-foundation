/** The sync engine's Life OS side, on Supabase under the signed-in user's own token (RLS applies). */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventLink, LifeEventRow, NewEventLink, SyncStore } from "@/data/googleSync/types";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
const EVENT_COLUMNS = "id,title,description,start_at,end_at,updated_at";
const CHUNK = 200;

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function supabaseSyncStore(db: Client, userId: string): SyncStore {
  return {
    async listLinks(calendarId) {
      return must(
        await db.from("google_event_links").select("*").eq("calendar_id", calendarId),
      ) as EventLink[];
    },
    async getEvents(ids) {
      const out: LifeEventRow[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        out.push(
          ...(must(await db.from("events").select(EVENT_COLUMNS).in("id", part)) as LifeEventRow[]),
        );
      }
      return out;
    },
    async listUnlinkedEvents(sinceIso) {
      const linked = new Set(
        (
          must(await db.from("google_event_links").select("event_id")) as {
            event_id: string | null;
          }[]
        ).map((l) => l.event_id),
      );
      const rows = must(
        await db.from("events").select(EVENT_COLUMNS).gte("start_at", sinceIso),
      ) as LifeEventRow[];
      return rows.filter((e) => !linked.has(e.id));
    },
    async createEvent(fields) {
      return must(
        await db
          .from("events")
          .insert({ ...fields, user_id: userId })
          .select(EVENT_COLUMNS)
          .single(),
      ) as LifeEventRow;
    },
    async updateEvent(id, fields) {
      return must(
        await db.from("events").update(fields).eq("id", id).select(EVENT_COLUMNS).single(),
      ) as LifeEventRow;
    },
    async deleteEvent(id) {
      must(await db.from("events").delete().eq("id", id));
    },
    async insertLink(link: NewEventLink) {
      return must(
        await db
          .from("google_event_links")
          .insert({ ...link, user_id: userId })
          .select("*")
          .single(),
      ) as EventLink;
    },
    async updateLink(id, patch) {
      must(await db.from("google_event_links").update(patch).eq("id", id));
    },
    async deleteLink(id) {
      must(await db.from("google_event_links").delete().eq("id", id));
    },
  };
}
