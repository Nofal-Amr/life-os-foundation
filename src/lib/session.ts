import type { User } from "@supabase/supabase-js";

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

/** The user from Supabase's stored session (localStorage), if any. */
export function storedUser(storage: Pick<Storage, "length" | "key" | "getItem"> | null = safeStorage()): User | null {
  if (!storage) return null;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null") as { user?: User } | null;
      if (value?.user?.id) return value.user;
    } catch {
      // Not ours or corrupt; ignore.
    }
  }
  return null;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
