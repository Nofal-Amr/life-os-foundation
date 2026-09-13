import { supabase } from "@/integrations/supabase/client";

/**
 * Always derive the owner id from the authenticated session — never from
 * client-provided input.
 */
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You must be signed in.");
  return data.user.id;
}

export function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error instanceof Error ? error : new Error(String(error));
  return data as T;
}
