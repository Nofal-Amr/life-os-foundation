/** The real Google calls, over fetch. Server only: it handles tokens. */
import {
  GoogleApiError,
  type GoogleCalendarApi,
  type GoogleCalendarEntry,
  type GoogleEvent,
  type GoogleEventBody,
  type GoogleEventPage,
} from "@/data/googleSync/types";

import type { GoogleConfig } from "./oauth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

async function fail(res: Response): Promise<never> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as {
      error?: { message?: string } | string;
      error_description?: string;
    };
    message =
      typeof body.error === "string"
        ? (body.error_description ?? body.error)
        : (body.error?.message ?? message);
  } catch {
    /* keep statusText */
  }
  throw new GoogleApiError(res.status, message);
}

export type TokenAnswer = {
  access_token: string;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

export async function exchangeCode(
  config: GoogleConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenAnswer> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) await fail(res);
  return (await res.json()) as TokenAnswer;
}

export async function refreshAccessToken(
  config: GoogleConfig,
  refreshToken: string,
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) await fail(res);
  return ((await res.json()) as TokenAnswer).access_token;
}

/** Best effort: a token Google already dropped is fine. */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

/** The email in Google's ID token. It came straight from Google over TLS. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
    };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export function calendarClient(accessToken: string) {
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) await fail(res);
    return (res.status === 204 ? undefined : await res.json()) as T;
  };
  const cal = (id: string) => `/calendars/${encodeURIComponent(id)}/events`;

  const api: GoogleCalendarApi & { listCalendars(): Promise<GoogleCalendarEntry[]> } = {
    async listCalendars() {
      const out: GoogleCalendarEntry[] = [];
      let pageToken: string | undefined;
      do {
        const q = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
        if (pageToken) q.set("pageToken", pageToken);
        const page = await call<{ items?: GoogleCalendarEntry[]; nextPageToken?: string }>(
          `/users/me/calendarList?${q}`,
        );
        out.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return out;
    },
    async listEvents(calendarId, query): Promise<GoogleEventPage> {
      const q = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
      if (query.syncToken) q.set("syncToken", query.syncToken);
      else if (query.timeMin) q.set("timeMin", query.timeMin);
      if (query.pageToken) q.set("pageToken", query.pageToken);
      const page = await call<GoogleEventPage & { items?: GoogleEvent[] }>(
        `${cal(calendarId)}?${q}`,
      );
      return { ...page, items: page.items ?? [] };
    },
    getEvent: (calendarId, eventId) =>
      call<GoogleEvent>(`${cal(calendarId)}/${encodeURIComponent(eventId)}`),
    insertEvent: (calendarId, body: GoogleEventBody) =>
      call<GoogleEvent>(cal(calendarId), { method: "POST", body: JSON.stringify(body) }),
    patchEvent: (calendarId, eventId, body, etag) =>
      call<GoogleEvent>(`${cal(calendarId)}/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: etag ? { "if-match": etag } : {},
      }),
    deleteEvent: async (calendarId, eventId) => {
      await call<void>(`${cal(calendarId)}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
    },
  };
  return api;
}
