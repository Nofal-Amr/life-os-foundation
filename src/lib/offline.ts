/**
 * Offline mode for Life OS (web and Android).
 *
 * Sits in front of window.fetch for Supabase REST calls (/rest/v1/*):
 * - Reads (GET/HEAD) are cached in IndexedDB and served from there whenever the
 *   network is unavailable.
 * - Writes (POST/PATCH/DELETE) made while offline go into an outbox, are applied
 *   to the cached reads straight away so the UI shows them, and are replayed in
 *   order once the device is back online.
 *
 * The generated Supabase client uses the global fetch lazily, so nothing in
 * src/integrations needs to change. RPC calls, auth and storage pass through.
 */
import { useSyncExternalStore } from "react";

type CachedResponse = { key: string; table: string; url: string; status: number; headers: Record<string, string>; body: string };
type OutboxEntry = { id?: number; url: string; method: string; headers: Record<string, string>; body: string; createdAt: string };
type Row = Record<string, unknown>;

export type SyncStatus = {
  online: boolean;
  pending: number;
  syncing: boolean;
  /** Last change the server refused (it was dropped from the queue). */
  lastRejected: string | null;
};

const DB_NAME = "life-os-offline";
const RESPONSES = "responses";
const OUTBOX = "outbox";
const CACHED_HEADERS = ["content-type", "content-range"];

let restBase = "";
let nativeFetch: typeof fetch;
let onSynced: (() => void) | null = null;
let getAccessToken: (() => Promise<string | null>) | null = null;
let installed = false;

let status: SyncStatus = { online: true, pending: 0, syncing: false, lastRejected: null };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}

/* ---------------------------------------------------------------- IndexedDB */

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(RESPONSES, { keyPath: "key" }).createIndex("table", "table");
      database.createObjectStore(OUTBOX, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name: string, mode: IDBTransactionMode = "readonly") {
  return (await db()).transaction(name, mode).objectStore(name);
}

async function outboxEntries(): Promise<OutboxEntry[]> {
  return done((await store(OUTBOX)).getAll()) as Promise<OutboxEntry[]>;
}

async function refreshPending() {
  try {
    setStatus({ pending: (await done((await store(OUTBOX)).count())) as number });
  } catch {
    // IndexedDB unavailable (private mode); offline mode is simply off.
  }
}

/** Wipes cached data and queued changes, e.g. when the user signs out. */
export async function clearOfflineData() {
  try {
    await done((await store(RESPONSES, "readwrite")).clear());
    await done((await store(OUTBOX, "readwrite")).clear());
  } catch {
    // Nothing cached.
  }
  setStatus({ pending: 0, lastRejected: null });
}

/* ---------------------------------------------------------- Request helpers */

function tableOf(url: URL): string | null {
  const path = url.pathname.split("/rest/v1/")[1];
  if (!path || path.startsWith("rpc/")) return null;
  return decodeURIComponent(path.split("/")[0] ?? "");
}

function cacheKey(method: string, url: string, accept: string) {
  return `${method} ${url} ${accept}`;
}

function headerObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => (out[key] = value));
  return out;
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name !== "AbortError");
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function offlineError() {
  return jsonResponse(
    { message: "You're offline. This will load again when you're back online.", code: "OFFLINE" },
    503,
  );
}

/* ------------------------------------------------------ PostgREST filtering */

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function compare(a: unknown, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (a !== null && a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(b);
}

/** true / false, or null when the filter uses an operator we don't evaluate. */
function matchOne(row: Row, column: string, expression: string): boolean | null {
  let negate = false;
  let expr = expression;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  if (dot < 0) return null;
  const op = expr.slice(0, dot);
  const value = expr.slice(dot + 1);
  const cell = row[column];
  let result: boolean;
  switch (op) {
    case "eq":
      result = cell !== null && cell !== undefined && String(cell) === value;
      break;
    case "neq":
      result = String(cell) !== value;
      break;
    case "gt":
      result = cell !== null && cell !== undefined && compare(cell, value) > 0;
      break;
    case "gte":
      result = cell !== null && cell !== undefined && compare(cell, value) >= 0;
      break;
    case "lt":
      result = cell !== null && cell !== undefined && compare(cell, value) < 0;
      break;
    case "lte":
      result = cell !== null && cell !== undefined && compare(cell, value) <= 0;
      break;
    case "is":
      result =
        value === "null" ? cell === null || cell === undefined : value === "true" ? cell === true : value === "false" ? cell === false : false;
      break;
    case "in": {
      const items = value.replace(/^\(|\)$/g, "").split(",").map((item) => item.replace(/^"|"$/g, ""));
      result = items.includes(String(cell));
      break;
    }
    default:
      return null;
  }
  return negate ? !result : result;
}

function matches(row: Row, params: URLSearchParams): boolean | null {
  let known = true;
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and" || key.includes(".")) {
      known = false;
      continue;
    }
    const result = matchOne(row, key, value);
    if (result === false) return false;
    if (result === null) known = false;
  }
  return known ? true : null;
}

function applyOrder(rows: Row[], params: URLSearchParams) {
  const order = params.get("order");
  if (!order) return rows;
  const terms = order.split(",").map((term) => {
    const [column = "", ...mods] = term.split(".");
    return { column, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") };
  });
  return [...rows].sort((a, b) => {
    for (const { column, desc, nullsFirst } of terms) {
      const x = a[column];
      const y = b[column];
      if (x === y) continue;
      if (x === null || x === undefined) return nullsFirst ? -1 : 1;
      if (y === null || y === undefined) return nullsFirst ? 1 : -1;
      const diff = compare(x, String(y));
      if (diff !== 0) return desc ? -diff : diff;
    }
    return 0;
  });
}

/* ------------------------------------------------- Apply writes to the cache */

type Write = { kind: "insert" | "update" | "delete"; table: string; params: URLSearchParams; rows: Row[]; patch: Row };

async function applyToCache(write: Write): Promise<Row[]> {
  const affected: Row[] = [];
  let responses: IDBObjectStore;
  let cached: CachedResponse[];
  try {
    responses = await store(RESPONSES);
    cached = (await done(responses.index("table").getAll(write.table))) as CachedResponse[];
  } catch {
    return write.kind === "insert" ? write.rows : [];
  }

  const updated: CachedResponse[] = [];
  for (const entry of cached) {
    if (entry.status < 200 || entry.status >= 300 || !entry.body) continue;
    let data: unknown;
    try {
      data = JSON.parse(entry.body);
    } catch {
      continue;
    }
    const readParams = new URL(entry.url).searchParams;
    const single = !Array.isArray(data);
    let rows = (single ? [data] : data) as Row[];
    let changed = false;

    if (write.kind === "insert") {
      if (single) continue;
      for (const row of write.rows) {
        if (matches(row, readParams) !== true) continue;
        const index = rows.findIndex((existing) => existing["id"] !== undefined && existing["id"] === row["id"]);
        if (index >= 0) rows[index] = { ...rows[index], ...row };
        else rows.push(row);
        changed = true;
      }
      if (changed) rows = applyOrder(rows, readParams);
    } else {
      const next: Row[] = [];
      for (const row of rows) {
        if (matches(row, write.params) === true) {
          changed = true;
          if (write.kind === "update") {
            const merged = { ...row, ...write.patch };
            affected.push(merged);
            // Keep it only if it still belongs in this list.
            if (single || matches(merged, readParams) !== false) next.push(merged);
          } else {
            affected.push(row);
          }
        } else {
          next.push(row);
        }
      }
      rows = next;
    }

    if (changed) {
      updated.push({ ...entry, body: single ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows) });
    }
  }

  if (updated.length) {
    const writable = await store(RESPONSES, "readwrite");
    await Promise.all(updated.map((entry) => done(writable.put(entry))));
  }
  if (write.kind === "insert") return write.rows;
  // De-duplicate rows seen in several cached lists.
  const byId = new Map<unknown, Row>();
  affected.forEach((row) => byId.set(row["id"] ?? byId.size, row));
  return [...byId.values()];
}

/* ------------------------------------------------------------ Fetch handlers */

async function handleRead(request: Request, url: URL, table: string): Promise<Response> {
  const key = cacheKey(request.method, url.href, request.headers.get("accept") ?? "");
  const pending = status.pending > 0;

  if (navigator.onLine && !pending) {
    try {
      const response = await nativeFetch(request.clone());
      if (response.ok) {
        const headers: Record<string, string> = {};
        CACHED_HEADERS.forEach((name) => {
          const value = response.headers.get(name);
          if (value) headers[name] = value;
        });
        const body = request.method === "HEAD" ? "" : await response.clone().text();
        const entry: CachedResponse = { key, table, url: url.href, status: response.status, headers, body };
        store(RESPONSES, "readwrite")
          .then((responses) => responses.put(entry))
          .catch(() => {});
      }
      if (!status.online) setStatus({ online: true });
      return response;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      setStatus({ online: false });
    }
  }

  // Offline, or local changes are still waiting to sync: serve the device copy
  // (which already includes those changes).
  try {
    const cached = (await done((await store(RESPONSES)).get(key))) as CachedResponse | undefined;
    if (cached) return new Response(cached.body || null, { status: cached.status, headers: cached.headers });
  } catch {
    // Fall through.
  }
  if (pending && navigator.onLine) return nativeFetch(request);
  return offlineError();
}

async function queueWrite(request: Request, url: URL, table: string, bodyText: string): Promise<Response> {
  const method = request.method;
  const params = url.searchParams;
  const accept = request.headers.get("accept") ?? "";
  const prefer = request.headers.get("prefer") ?? "";
  const now = new Date().toISOString();
  let body = bodyText;
  let result: Row[] = [];

  if (method === "POST") {
    const parsed = bodyText ? (JSON.parse(bodyText) as Row | Row[]) : [];
    const rows = (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
      ...row,
      // Client ids let the queued insert and the local copy agree once synced.
      id: row["id"] ?? crypto.randomUUID(),
      created_at: row["created_at"] ?? now,
      updated_at: row["updated_at"] ?? now,
    }));
    body = JSON.stringify(Array.isArray(parsed) ? rows : rows[0]);
    result = await applyToCache({ kind: "insert", table, params, rows, patch: {} });
  } else if (method === "PATCH") {
    const patch = bodyText ? (JSON.parse(bodyText) as Row) : {};
    result = await applyToCache({ kind: "update", table, params, rows: [], patch });
    if (!result.length) {
      const id = params.get("id");
      result = [{ ...patch, ...(id?.startsWith("eq.") ? { id: id.slice(3) } : {}) }];
    }
  } else if (method === "DELETE") {
    result = await applyToCache({ kind: "delete", table, params, rows: [], patch: {} });
  }

  const headers = headerObject(request.headers);
  delete headers["authorization"];
  const entry: OutboxEntry = { url: url.href, method, headers, body, createdAt: now };
  await done((await store(OUTBOX, "readwrite")).add(entry));
  await refreshPending();

  const wantsRows = prefer.includes("return=representation");
  if (!wantsRows) return new Response(null, { status: method === "POST" ? 201 : 204 });
  const single = accept.includes("vnd.pgrst.object");
  return jsonResponse(single ? (result[0] ?? null) : result, method === "POST" ? 201 : 200);
}

async function handleWrite(request: Request, url: URL, table: string): Promise<Response> {
  const bodyText = await request.clone().text();
  // Keep order: once anything is queued, later writes queue behind it.
  if (navigator.onLine && status.pending === 0) {
    try {
      const response = await nativeFetch(request);
      if (!status.online) setStatus({ online: true });
      if (response.ok) void mirrorOnlineWrite(request.method, url, table, bodyText, response.clone());
      return response;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      setStatus({ online: false });
    }
  }
  return queueWrite(request, url, table, bodyText);
}

/** Keeps the device copy in step with writes that reached the server. */
async function mirrorOnlineWrite(method: string, url: URL, table: string, bodyText: string, response: Response) {
  try {
    const params = url.searchParams;
    if (method === "POST") {
      const text = await response.text();
      const parsed = (text ? JSON.parse(text) : bodyText ? JSON.parse(bodyText) : []) as Row | Row[];
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.every((row) => row["id"] !== undefined)) await applyToCache({ kind: "insert", table, params, rows, patch: {} });
    } else if (method === "PATCH") {
      await applyToCache({ kind: "update", table, params, rows: [], patch: bodyText ? (JSON.parse(bodyText) as Row) : {} });
    } else if (method === "DELETE") {
      await applyToCache({ kind: "delete", table, params, rows: [], patch: {} });
    }
  } catch {
    // The next online read refreshes the cache anyway.
  }
}

/* ---------------------------------------------------------------- Syncing */

let flushing: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  flushing ??= flush().finally(() => (flushing = null));
  return flushing;
}

async function flush() {
  if (!navigator.onLine) return;
  let entries: OutboxEntry[];
  try {
    entries = await outboxEntries();
  } catch {
    return;
  }
  if (!entries.length) return;
  setStatus({ syncing: true });
  const token = (await getAccessToken?.()) ?? null;
  let synced = false;

  for (const entry of entries) {
    const headers = { ...entry.headers };
    if (token) headers["authorization"] = `Bearer ${token}`;
    // Replays must be safe to repeat if a response was lost on the way back.
    if (entry.method === "POST") {
      const prefer = headers["prefer"] ?? "";
      if (!prefer.includes("resolution=")) headers["prefer"] = [prefer, "resolution=ignore-duplicates"].filter(Boolean).join(",");
    }
    let response: Response;
    try {
      response = await nativeFetch(entry.url, { method: entry.method, headers, body: entry.body || null });
    } catch {
      setStatus({ online: false });
      break;
    }
    if (response.status === 401 || response.status >= 500) break; // Try again later.
    if (!response.ok) {
      let message = `A change couldn't be saved (${response.status}).`;
      try {
        const error = (await response.json()) as { message?: string };
        if (error.message) message = `A change couldn't be saved: ${error.message}`;
      } catch {
        // Keep the generic message.
      }
      setStatus({ lastRejected: message });
    }
    await done((await store(OUTBOX, "readwrite")).delete(entry.id!));
    synced = true;
  }

  await refreshPending();
  setStatus({ syncing: false });
  // Refetch everything so server-side values (defaults, triggers) replace the local copies.
  if (synced && status.pending === 0) onSynced?.();
}

export function dismissRejected() {
  setStatus({ lastRejected: null });
}

/* ---------------------------------------------------------------- Install */

export function installOffline(options: {
  supabaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  onSynced: () => void;
}) {
  if (installed || typeof window === "undefined" || !("indexedDB" in window)) return;
  installed = true;
  restBase = `${options.supabaseUrl.replace(/\/$/, "")}/rest/v1/`;
  getAccessToken = options.getAccessToken;
  onSynced = options.onSynced;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!href.startsWith(restBase)) return nativeFetch(input, init);
    const request = new Request(input, init);
    const url = new URL(request.url);
    const table = tableOf(url);
    if (!table) return nativeFetch(request);
    if (request.method === "GET" || request.method === "HEAD") return handleRead(request, url, table);
    if (["POST", "PATCH", "DELETE"].includes(request.method)) return handleWrite(request, url, table);
    return nativeFetch(request);
  };

  setStatus({ online: navigator.onLine });
  window.addEventListener("online", () => {
    setStatus({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => setStatus({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  window.setInterval(() => {
    if (status.pending > 0) void syncNow();
  }, 30_000);
  void refreshPending().then(() => syncNow());
}
