/**
 * Google Calendar sync: the server functions the browser calls.
 *
 * Every one needs a signed-in user and talks to the database with that user's
 * own token, so row-level security applies. Tokens never leave the server:
 * the browser only ever sees the account email, calendar names and sync times.
 * Server-only modules are imported inside the handlers so none of them can
 * end up in the browser bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoogleCalendarStatus =
  | { state: "not_configured" }
  | { state: "disconnected" }
  | {
      state: "connected";
      email: string | null;
      readCalendarIds: string[];
      writeCalendarId: string | null;
      syncEnabled: boolean;
      lastSyncAt: string | null;
      lastError: string | null;
    };

export type GoogleCalendarChoice = {
  id: string;
  name: string;
  primary: boolean;
  canWrite: boolean;
};

export type SyncSummary = {
  ok: boolean;
  skipped?: boolean;
  message: string;
};

/** A missing table means the database change isn't approved yet: same as "not set up". */
function isMissingTable(message: string) {
  return /does not exist|schema cache|Could not find the table/i.test(message);
}

async function server() {
  const [{ readGoogleConfig }, secrets, api] = await Promise.all([
    import("./google/oauth"),
    import("./google/secrets.server"),
    import("./google/api.server"),
  ]);
  return { config: readGoogleConfig(process.env), secrets, api };
}

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleCalendarStatus> => {
    const { config } = await server();
    if (!config) return { state: "not_configured" };
    const res = await context.supabase
      .from("google_calendar_connections")
      .select(
        "account_email,read_calendar_ids,write_calendar_id,sync_enabled,last_sync_at,last_error",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (res.error) {
      if (isMissingTable(res.error.message)) return { state: "not_configured" };
      throw new Error(res.error.message);
    }
    if (!res.data) return { state: "disconnected" };
    return {
      state: "connected",
      email: res.data.account_email,
      readCalendarIds: res.data.read_calendar_ids,
      writeCalendarId: res.data.write_calendar_id,
      syncEnabled: res.data.sync_enabled,
      lastSyncAt: res.data.last_sync_at,
      lastError: res.data.last_error,
    };
  });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ codeChallenge: z.string().min(43).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { config, secrets } = await server();
    if (!config) throw new Error("Google Calendar isn't set up yet.");
    const { buildConsentUrl } = await import("./google/oauth");
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : undefined;
    return {
      url: buildConsentUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state: secrets.signState(context.userId, config.tokenKey),
        codeChallenge: data.codeChallenge,
        loginHint: email,
      }),
    };
  });

export const finishGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().min(1).max(2048),
        state: z.string().min(1).max(1024),
        codeVerifier: z.string().min(43).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { config, secrets, api } = await server();
    if (!config) throw new Error("Google Calendar isn't set up yet.");
    if (!secrets.verifyState(data.state, context.userId, config.tokenKey)) {
      throw new Error("This sign-in link has expired or belongs to another account. Try again.");
    }
    const { hasNeededScopes } = await import("./google/oauth");
    const tokens = await api.exchangeCode(config, data.code, data.codeVerifier);
    if (!hasNeededScopes(tokens.scope)) {
      await api.revokeToken(tokens.access_token);
      throw new Error(
        "Life OS needs calendar access to sync. Tick both calendar boxes on Google's page.",
      );
    }
    if (!tokens.refresh_token) {
      throw new Error("Google didn't give lasting access. Try connecting again.");
    }
    const res = await context.supabase.from("google_calendar_connections").upsert({
      user_id: context.userId,
      account_email: api.emailFromIdToken(tokens.id_token),
      refresh_token_enc: secrets.sealToken(tokens.refresh_token, context.userId, config.tokenKey),
      scopes: tokens.scope,
      read_calendar_ids: ["primary"],
      write_calendar_id: "primary",
      sync_enabled: false,
      sync_tokens: {},
      last_error: null,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

async function accessFor(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
}) {
  const { config, secrets, api } = await server();
  if (!config) throw new Error("Google Calendar isn't set up yet.");
  const res = await context.supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", context.userId)
    .single();
  if (res.error) throw new Error(res.error.message);
  const refresh = secrets.openToken(res.data.refresh_token_enc, context.userId, config.tokenKey);
  return { config, api, row: res.data, refresh };
}

export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleCalendarChoice[]> => {
    const { config, api, refresh } = await accessFor(context);
    const client = api.calendarClient(await api.refreshAccessToken(config, refresh));
    const list = await client.listCalendars();
    return list
      .map((c) => ({
        id: c.primary ? "primary" : c.id,
        name: c.summary,
        primary: !!c.primary,
        canWrite: c.accessRole === "owner" || c.accessRole === "writer",
      }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
  });

export const saveGoogleCalendarChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        readIds: z.array(z.string().min(1).max(256)).min(1).max(20),
        writeId: z.string().min(1).max(256).nullable(),
      })
      .refine((v) => v.writeId === null || v.readIds.includes(v.writeId), {
        message: "The calendar for new events must also be shown.",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const current = await context.supabase
      .from("google_calendar_connections")
      .select("sync_tokens")
      .eq("user_id", context.userId)
      .single();
    if (current.error) throw new Error(current.error.message);
    const tokens = (current.data.sync_tokens ?? {}) as Record<string, string>;
    const kept = Object.fromEntries(
      Object.entries(tokens).filter(([id]) => data.readIds.includes(id)),
    );
    // Calendars no longer chosen stop syncing; their events stay as normal Life OS events.
    const linked = await context.supabase.from("google_event_links").select("calendar_id");
    if (linked.error) throw new Error(linked.error.message);
    const linkedIds = new Set([...Object.keys(tokens), ...linked.data.map((l) => l.calendar_id)]);
    for (const id of [...linkedIds].filter((id) => !data.readIds.includes(id))) {
      const dropped = await context.supabase
        .from("google_event_links")
        .delete()
        .eq("calendar_id", id);
      if (dropped.error) throw new Error(dropped.error.message);
    }
    const res = await context.supabase
      .from("google_calendar_connections")
      .update({
        read_calendar_ids: data.readIds,
        write_calendar_id: data.writeId,
        sync_enabled: true,
        sync_tokens: kept,
      })
      .eq("user_id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** Plain words for the person, never a raw API error. */
function calmError(error: unknown): string {
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid_grant|expired or revoked/i.test(message) || status === 401) {
    return "Google access was removed. Connect again to keep syncing.";
  }
  if (status === 403 || status === 429)
    return "Google asked us to slow down. It will try again later.";
  return "Sync didn't finish. It will try again next time.";
}

export const syncGoogleCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncSummary> => {
    const { config, api, row, refresh } = await accessFor(context);
    if (!row.sync_enabled)
      return { ok: false, skipped: true, message: "Choose your calendars first." };

    // A short lease so two open tabs don't sync at the same time.
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - 15_000).toISOString();
    const lease = await context.supabase
      .from("google_calendar_connections")
      .update({ last_sync_at: now.toISOString() })
      .eq("user_id", context.userId)
      .or(`last_sync_at.is.null,last_sync_at.lt.${leaseCutoff}`)
      .select("user_id");
    if (lease.error) throw new Error(lease.error.message);
    if (!lease.data?.length)
      return { ok: true, skipped: true, message: "A sync just ran. Try again in a few seconds." };

    const [{ syncCalendar }, { supabaseSyncStore }] = await Promise.all([
      import("@/data/googleSync/engine"),
      import("./google/store.server"),
    ]);
    const tokens = { ...((row.sync_tokens ?? {}) as Record<string, string>) };
    let totals = {
      imported: 0,
      updatedHere: 0,
      removedHere: 0,
      sentToGoogle: 0,
      removedFromGoogle: 0,
    };
    let lastError: string | null = null;
    try {
      const client = api.calendarClient(await api.refreshAccessToken(config, refresh));
      const calendars = new Map(
        (await client.listCalendars()).map((c) => [c.primary ? "primary" : c.id, c]),
      );
      const store = supabaseSyncStore(context.supabase, context.userId);
      for (const calendarId of row.read_calendar_ids) {
        const entry = calendars.get(calendarId);
        if (!entry) continue; // unshared or deleted in Google
        const canWrite = entry.accessRole === "owner" || entry.accessRole === "writer";
        const r = await syncCalendar({
          calendarId,
          canWrite,
          pushNew: canWrite && calendarId === row.write_calendar_id,
          syncToken: tokens[calendarId] ?? null,
          timeZone: entry.timeZone ?? "UTC",
          now,
          google: client,
          store,
        });
        if (r.syncToken) tokens[calendarId] = r.syncToken;
        totals = {
          imported: totals.imported + r.imported,
          updatedHere: totals.updatedHere + r.updatedHere,
          removedHere: totals.removedHere + r.removedHere,
          sentToGoogle: totals.sentToGoogle + r.sentToGoogle,
          removedFromGoogle: totals.removedFromGoogle + r.removedFromGoogle,
        };
      }
    } catch (error) {
      console.error("[google-calendar] sync failed", (error as Error).message);
      lastError = calmError(error);
    }
    await context.supabase
      .from("google_calendar_connections")
      .update({
        sync_tokens: tokens,
        last_sync_at: new Date().toISOString(),
        last_error: lastError,
      })
      .eq("user_id", context.userId);
    if (lastError) return { ok: false, message: lastError };
    const here = totals.imported + totals.updatedHere + totals.removedHere;
    const there = totals.sentToGoogle + totals.removedFromGoogle;
    return {
      ok: true,
      message:
        here + there === 0
          ? "Up to date."
          : `${here} change${here === 1 ? "" : "s"} from Google, ${there} sent to Google.`,
    };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ removeImported: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { config, secrets, api } = await server();
    const row = await context.supabase
      .from("google_calendar_connections")
      .select("refresh_token_enc")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (row.error) throw new Error(row.error.message);
    if (row.data && config) {
      try {
        await api.revokeToken(
          secrets.openToken(row.data.refresh_token_enc, context.userId, config.tokenKey),
        );
      } catch {
        /* still forget it below */
      }
    }
    if (data.removeImported) {
      const links = await context.supabase
        .from("google_event_links")
        .select("event_id")
        .eq("origin", "google")
        .not("event_id", "is", null);
      if (links.error) throw new Error(links.error.message);
      const ids = links.data.flatMap((l) => (l.event_id ? [l.event_id] : []));
      for (let i = 0; i < ids.length; i += 200) {
        const del = await context.supabase
          .from("events")
          .delete()
          .in("id", ids.slice(i, i + 200));
        if (del.error) throw new Error(del.error.message);
      }
    }
    const links = await context.supabase
      .from("google_event_links")
      .delete()
      .eq("user_id", context.userId);
    if (links.error) throw new Error(links.error.message);
    const conn = await context.supabase
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", context.userId);
    if (conn.error) throw new Error(conn.error.message);
    return { ok: true };
  });
