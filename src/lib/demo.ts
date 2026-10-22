/**
 * Demo mode: Life OS with sample data and no account. Every database request
 * (Supabase REST) is answered from an in-browser copy of the sample data, so
 * every screen can be tried and tested without signing in, and nothing is
 * sent to the server. Changes stay in this browser until "Reset demo".
 */
import { supabase } from "@/integrations/supabase/client";
import { DEMO_USER, demoSeed, type DemoDb } from "@/data/demoSeed";
import { applyOrder, matches } from "@/lib/offline";

const FLAG = "lifeos:demo";
const STORE = "lifeos:demo-db";

type Row = Record<string, unknown>;

export function isDemo(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function startDemo() {
  try {
    localStorage.setItem(FLAG, "1");
    localStorage.removeItem(STORE);
  } catch {
    // Without storage the demo can't start.
  }
  window.location.assign("/dashboard");
}

export function exitDemo() {
  try {
    localStorage.removeItem(FLAG);
    localStorage.removeItem(STORE);
  } catch {
    // Nothing to clear.
  }
  window.location.assign("/");
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORE);
  } catch {
    // Nothing to clear.
  }
  window.location.reload();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/*" },
  });
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/** A filter matches unless it says no (filters we can't evaluate let rows through). */
const keeps = (row: Row, params: URLSearchParams) => matches(row, params) !== false;

/** One PostgREST-style request against the demo tables. */
export async function handleDemoRequest(db: DemoDb, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.split("/rest/v1/")[1] ?? "";
  if (path.startsWith("rpc/")) {
    return json({ message: "That isn't available in the demo.", code: "DEMO" }, 400);
  }
  const table = decodeURIComponent(path.split("/")[0] ?? "");
  const rows = (db[table] ??= []);
  const params = url.searchParams;
  const single = (request.headers.get("Accept") ?? "").includes("vnd.pgrst.object+json");
  const answer = (list: Row[]) => {
    if (!single) return json(list);
    if (list.length !== 1) {
      return json(
        {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: null,
          hint: null,
        },
        406,
      );
    }
    return json(list[0]);
  };

  if (request.method === "GET" || request.method === "HEAD") {
    let list = applyOrder(
      rows.filter((row) => keeps(row, params)),
      params,
    );
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.get("limit");
    list = list.slice(offset, limit ? offset + Number(limit) : undefined);
    return answer(list);
  }

  const text = request.method === "DELETE" ? "" : await request.text();
  const body = text ? (JSON.parse(text) as Row | Row[]) : {};
  const now = new Date().toISOString();

  if (request.method === "POST") {
    const conflict = params.get("on_conflict")?.split(",");
    const merge = (request.headers.get("Prefer") ?? "").includes("merge-duplicates") || !!conflict;
    const saved: Row[] = [];
    for (const input of Array.isArray(body) ? body : [body]) {
      const incoming: Row = { user_id: DEMO_USER, created_at: now, updated_at: now, ...input };
      const existing = merge
        ? rows.find((row) =>
            conflict?.length
              ? conflict.every(
                  (column) =>
                    row[column] === undefined || String(row[column]) === String(incoming[column]),
                )
              : row["id"] !== undefined && row["id"] === incoming["id"],
          )
        : undefined;
      if (existing) {
        Object.assign(existing, input, { updated_at: now });
        saved.push(existing);
      } else {
        const row = { id: newId(), ...incoming };
        rows.push(row);
        saved.push(row);
      }
    }
    return answer(saved);
  }

  if (request.method === "PATCH") {
    const changed = rows.filter((row) => keeps(row, params));
    for (const row of changed) Object.assign(row, body, { updated_at: now });
    return answer(changed);
  }

  if (request.method === "DELETE") {
    const removed = rows.filter((row) => keeps(row, params));
    db[table] = rows.filter((row) => !removed.includes(row));
    return answer(removed);
  }

  return json({ message: "Not supported in the demo." }, 405);
}

function loadDb(): DemoDb {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) return JSON.parse(saved) as DemoDb;
  } catch {
    // Start fresh.
  }
  return demoSeed();
}

function saveDb(db: DemoDb) {
  try {
    localStorage.setItem(STORE, JSON.stringify(db));
  } catch {
    // This visit only.
  }
}

/**
 * Turns on demo mode for this page: a signed-in demo session, and every
 * Supabase request answered locally. Returns false when not in demo mode.
 */
export function installDemo(supabaseUrl: string): boolean {
  if (typeof window === "undefined" || !isDemo()) return false;
  const db = loadDb();
  const base = supabaseUrl.replace(/\/$/, "");
  const nativeFetch = window.fetch.bind(window);

  const user = {
    id: DEMO_USER,
    aud: "authenticated",
    role: "authenticated",
    email: "demo@life-os.local",
    app_metadata: {},
    user_metadata: { display_name: "Demo" },
    created_at: new Date().toISOString(),
  };
  const session = {
    access_token: "demo",
    refresh_token: "demo",
    token_type: "bearer",
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    user,
  };
  const auth = supabase.auth as unknown as Record<string, unknown>;
  auth["getSession"] = async () => ({ data: { session }, error: null });
  auth["getUser"] = async () => ({ data: { user }, error: null });
  auth["onAuthStateChange"] = (callback: (event: string, value: unknown) => void) => {
    setTimeout(() => callback("SIGNED_IN", session), 0);
    return { data: { subscription: { unsubscribe() {} } } };
  };
  auth["signOut"] = async () => {
    exitDemo();
    return { error: null };
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!href.startsWith(base)) return nativeFetch(input, init);
    if (href.startsWith(`${base}/rest/v1/`)) {
      const response = await handleDemoRequest(db, new Request(input, init));
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (method !== "GET" && method !== "HEAD") saveDb(db);
      return response;
    }
    // Auth, storage and functions: nothing leaves the browser in the demo.
    return json({ message: "Not available in the demo." }, 400);
  };
  return true;
}
