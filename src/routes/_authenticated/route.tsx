import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

import { AppLayout } from "@/components/app/AppLayout";
import { ModuleDisabled } from "@/components/app/ModuleDisabled";
import { Onboarding } from "@/components/app/Onboarding";
import { LoadingState } from "@/components/app/States";
import { enabledModules, moduleForPath } from "@/data/modules";
import { preferencesQuery } from "@/data/preferences";
import { currentUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Works offline: the stored session decides what to show; the server
    // still checks every request with row-level security.
    const user = await currentUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const preferences = useQuery(preferencesQuery());
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (preferences.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <LoadingState rows={4} />
        </div>
      </div>
    );
  }

  /* A brand new user gets setup instead of nineteen empty pages. */
  if (preferences.data && !preferences.data.onboarding_completed_at) {
    return <Onboarding />;
  }

  const module = moduleForPath(pathname);
  const enabled = enabledModules(preferences.data?.enabled_modules);

  return (
    <AppLayout>
      {module && !enabled.includes(module) ? <ModuleDisabled module={module} /> : <Outlet />}
    </AppLayout>
  );
}
