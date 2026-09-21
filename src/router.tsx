import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { supabase } from "./integrations/supabase/client";
import { installOffline } from "./lib/offline";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Never refetch behind a form the user is filling in.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        // Always run: the offline layer (src/lib/offline.ts) answers from the
        // device copy when there's no network.
        networkMode: "always",
      },
      mutations: { networkMode: "always" },
    },
  });

  installOffline({
    supabaseUrl: String((supabase as unknown as { supabaseUrl: string | URL }).supabaseUrl),
    getAccessToken: async () =>
      (await supabase.auth.getSession()).data.session?.access_token ?? null,
    onSynced: () => void queryClient.invalidateQueries(),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
