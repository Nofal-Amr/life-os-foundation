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
