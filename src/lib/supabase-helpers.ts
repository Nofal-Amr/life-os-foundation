import { supabase } from "@/integrations/supabase/client";

/**
 * Always derive the owner id from the authenticated session — never from
 * client-provided input.
 */
export async function currentUserId(): Promise<string> {
  // getSession reads the stored session, so this works offline. Row-level
  // security still checks the token on the server for every request.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("You must be signed in.");
  return data.session.user.id;
}

export function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw toError(error);
  return data as T;
}

/**
 * Supabase returns plain objects ({ message, code, ... }), not Error instances,
 * so String(error) would show "[object Object]". Network failures get a plain
 * offline message instead of the browser's "Failed to fetch".
 */
export function toError(error: unknown): Error {
  if (error instanceof Error && !isNetworkMessage(error.message)) return error;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
          ? error
          : "";
  if (
    isNetworkMessage(message) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return new Error("You're offline. This will load again when you're back online.");
  }
  return new Error(message || "Something went wrong. Please try again.");
}

function isNetworkMessage(message: string) {
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

/**
 * Runs a write, and if Supabase says a column doesn't exist yet (a migration
 * not applied), retries without that column. New features then degrade to
 * the old behaviour instead of breaking saves.
 */
export async function writeWithColumnFallback<
  I extends Record<string, unknown>,
  R extends { error: unknown },
>(input: I, run: (row: I) => PromiseLike<R>): Promise<R> {
  let row = input;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await run(row);
    const error = result.error as { code?: string; message?: string } | null;
    const column =
      error?.code === "PGRST204" ? /'([^']+)' column/.exec(error.message ?? "")?.[1] : undefined;
    if (!column || !(column in row)) return result;
    reportMissingColumn(column);
    const { [column]: _dropped, ...rest } = row;
    row = rest as I;
  }
  return run(row);
}

/**
 * Columns that saves had to drop because the database hasn't been updated.
 * The app shows a notice (MigrationNotice) so this never fails silently.
 */
const missingColumns = new Set<string>();
const missingListeners = new Set<() => void>();

function reportMissingColumn(column: string) {
  if (missingColumns.has(column)) return;
  missingColumns.add(column);
  missingListeners.forEach((listener) => listener());
}

export function getMissingColumns(): string[] {
  return [...missingColumns];
}

export function onMissingColumns(listener: () => void): () => void {
  missingListeners.add(listener);
  return () => missingListeners.delete(listener);
}
