import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { finishGoogleConnect } from "@/lib/googleCalendar.functions";
import { PKCE_STORAGE_KEY } from "@/lib/google/pkce";

/** Google sends people back here after its consent screen. */
export const Route = createFileRoute("/_authenticated/google-calendar/callback")({
  head: () => ({ meta: [{ title: "Connecting Google Calendar · Life OS" }] }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ran = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error");
    let verifier: string | null = null;
    try {
      verifier = sessionStorage.getItem(PKCE_STORAGE_KEY);
      sessionStorage.removeItem(PKCE_STORAGE_KEY);
    } catch {
      /* no storage: handled below */
    }
    // Take the one-time code out of the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);

    if (denied) {
      setProblem("Google Calendar wasn't connected. You can try again from Settings.");
      return;
    }
    if (!code || !state || !verifier) {
      setProblem("This link has expired. Start again from Settings.");
      return;
    }
    finishGoogleConnect({ data: { code, state, codeVerifier: verifier } })
      .then(async () => {
        await qc.invalidateQueries({ queryKey: ["google-calendar"] });
        toast.success("Google Calendar connected. Choose which calendars to sync.");
        void navigate({ to: "/settings" });
      })
      .catch((e: unknown) =>
        setProblem(e instanceof Error ? e.message : "Google Calendar wasn't connected. Try again."),
      );
  }, [navigate, qc]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">{problem ?? "Connecting Google Calendar…"}</p>
      {problem ? (
        <Button onClick={() => void navigate({ to: "/settings" })}>Back to Settings</Button>
      ) : null}
    </div>
  );
}
