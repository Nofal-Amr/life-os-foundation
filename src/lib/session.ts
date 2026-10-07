import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * The signed-in user for gating pages, without needing the network.
 *
 * getSession reads the stored session, but when the access token has expired
 * it tries to refresh, which fails offline. In that case the stored session
 * is still the right answer for showing the app from its offline copy: every
 * server request is checked by row-level security anyway, so this only
 * decides what to render, never what data can be read.
 */
export async function currentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;
  } catch {
    // Fall through to the stored copy.
  }
  return storedUser();
}

type StorageLike = Pick<Storage, "length" | "key" | "getItem">;

/** Supabase's stored session (localStorage), if any. */
export function storedSession(storage: StorageLike | null = safeStorage()): Session | null {
  if (!storage) return null;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null") as Session | null;
      if (value?.user?.id) return value;
    } catch {
      // Not ours or corrupt; ignore.
    }
  }
  return null;
}

/** The user from Supabase's stored session (localStorage), if any. */
export function storedUser(storage: StorageLike | null = safeStorage()): User | null {
  return storedSession(storage)?.user ?? null;
}

/** How long a sign-in check may take before the stored session answers instead. */
const SESSION_WAIT_MS = 4000;

let sessionInstalled = false;

/**
 * Keeps the app usable offline. With an expired access token, getSession
 * tries to refresh it and, with no network, keeps retrying for about 25
 * seconds before giving up — and every page and request waits on it, so the
 * app looks like it won't open. Offline (or when the check is slow) the
 * stored session answers straight away: the device copy and the outbox don't
 * need a fresh token, and the outbox signs its replays with a fresh one once
 * the network is back. The server still checks every request.
 */
export function installOfflineSession(isOffline: () => boolean): void {
  if (sessionInstalled) return;
  sessionInstalled = true;
  const auth = supabase.auth;
  const original = auth.getSession.bind(auth);
  const fromStore = () => {
    const session = storedSession();
    return session ? { data: { session }, error: null } : null;
  };
  auth.getSession = (async () => {
    const stored = fromStore();
    if (!stored) return original();
    if (isOffline()) return stored;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slow = new Promise<typeof stored>((resolve) => {
      timer = setTimeout(() => resolve(fromStore() ?? stored), SESSION_WAIT_MS);
    });
    const live = original().then((result) => {
      // A refresh that failed for lack of network isn't a sign-out.
      if (!result.data.session && result.error) return fromStore() ?? result;
      return result;
    });
    try {
      return await Promise.race([live, slow]);
    } finally {
      clearTimeout(timer);
    }
  }) as typeof auth.getSession;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
