import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { noteKeys } from "@/data/notes";
import { supabase } from "@/integrations/supabase/client";
import { isDemo } from "@/lib/demo";

/** How often an open daily note checks for edits from your other devices. */
export const LIVE_POLL_MS = 4000;

/**
 * Keeps notes current across devices while a page that needs it is open.
 *
 * Two paths, so it works whatever the server allows:
 * - Supabase Realtime: when `notes` is in the realtime publication, a change
 *   on another device arrives at once and refreshes the list.
 * - A light poll (see LIVE_POLL_MS, used by the page's query) that covers the
 *   time before that is switched on, and any dropped connection.
 *
 * Nothing is sent over the socket but "something changed"; the notes
 * themselves are read again through the usual row-level-security checks.
 */
export function useLiveNotes(enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || isDemo()) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId || cancelled) return;
      channel = supabase
        .channel(`notes-live-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${userId}` },
          () => void queryClient.invalidateQueries({ queryKey: noteKeys.all }),
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
