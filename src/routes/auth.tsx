import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  ANDROID_CALLBACK,
  GOOGLE_CLIENT_ID,
  HANDOFF_PARAM,
  WEB_ORIGIN,
  handoffUrl,
  loadGoogleIdentity,
  makeNonce,
} from "@/lib/googleIdentity";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Life OS" },
      { name: "description", content: "Sign in to your private Life OS workspace." },
      { property: "og:title", content: "Sign in · Life OS" },
      { property: "og:description", content: "Sign in to your private Life OS workspace." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

/** Set by mobile/android MainActivity on its WebView user agent. */
const ANDROID_APP_UA = "LifeOSAndroid";
/** Set by mobile/ios on its WKWebView (applicationNameForUserAgent). */
const IOS_APP_UA = "LifeOSiOS";

/** Asks Supabase whether a provider is enabled, so users never land on a raw error page. */
async function providerEnabled(provider: "google"): Promise<boolean> {
  try {
    const client = supabase as unknown as { supabaseUrl: string | URL; supabaseKey: string };
    const response = await fetch(
      `${String(client.supabaseUrl).replace(/\/$/, "")}/auth/v1/settings`,
      {
        headers: { apikey: client.supabaseKey },
      },
    );
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.[provider] === true;
  } catch {
    return true; // Let Supabase report the problem.
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  // Opened from the Android app: sign in here, then give the session back to it.
  const [handoff] = useState(
    () => new URLSearchParams(window.location.search).get(HANDOFF_PARAM) === "android",
  );
  const [handedOff, setHandedOff] = useState<string | null>(null);
  const agent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const inAndroid = agent.includes(ANDROID_APP_UA);
  // Either phone app: Google's own button can't run inside an app's web view.
  const inApp = inAndroid || agent.includes(IOS_APP_UA);
  const [gisFailed, setGisFailed] = useState(false);
  const useGis = !!GOOGLE_CLIENT_ID && !inApp && !gisFailed;

  /** Sends the session to the app and forgets it here, so only the app refreshes it. */
  async function returnToApp(session: Session) {
    const url = handoffUrl(session);
    await supabase.auth.signOut({ scope: "local" });
    setHandedOff(url);
    window.location.href = url;
  }

  useEffect(() => {
    // A Google sign-in returns here with tokens (#access_token=…), a code
    // (?code=…) or an error. Supabase reads them itself; we only surface
    // failures, which it otherwise swallows silently.
    const params = new URLSearchParams(
      `${window.location.search.slice(1)}&${window.location.hash.slice(1)}`,
    );
    const returned = params.has("access_token") || params.has("code") || params.has("error");
    if (returned) {
      console.info(
        `auth callback: token=${params.has("access_token")} code=${params.has("code")} error=${params.get("error") ?? "none"}`,
      );
    }
    const urlError = params.get("error_description") ?? params.get("error");
    if (urlError) toast.error(`Google sign-in didn't finish: ${urlError.replace(/\+/g, " ")}`);

    if (handoff) {
      // A session already in this browser stays here; the app gets a fresh one.
      void supabase.auth.signOut({ scope: "local" });
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) void returnToApp(session);
      });
      return () => data.subscription.unsubscribe();
    }

    // getSession works offline; it also waits for Supabase to read the callback.
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else if (returned && !urlError) {
        console.warn(`auth callback: no session (${error?.message ?? "no error"})`);
        toast.error("Google sign-in didn't finish. Please try again.");
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, handoff]);

  async function signInWith(provider: "google") {
    setPending(true);
    try {
      if (!(await providerEnabled(provider))) {
        toast.message("Google sign-in isn't switched on yet. Use email for now.");
        setPending(false);
        return;
      }
      // The Android app can't show Google's sign-in inside its WebView. With
      // Google's button set up, sign-in happens on the website in the phone's
      // browser and comes back through lifeos://; otherwise Supabase's redirect
      // flow opens in the browser and returns the same way.
      // The iPhone app runs Supabase's flow in the system sign-in sheet itself.
      if (inAndroid && GOOGLE_CLIENT_ID) {
        window.location.href = `${WEB_ORIGIN}/auth?${HANDOFF_PARAM}=android`;
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: inApp ? ANDROID_CALLBACK : `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start sign-in.");
      setPending(false);
    }
  }

  async function submit() {
    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // For the app, the sign-in listener hands the session back instead.
        if (!handoff) navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
        const { data } = await supabase.auth.getUser();
        if (data.user && !handoff) navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent.");
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            <Link to="/" className="rounded-md">
              Life OS
            </Link>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your calm, private space for projects, habits and reflection.
          </p>
        </div>

        {handoff ? (
          <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {handedOff
              ? "You're signed in. Life OS should open now."
              : "Signing in for the Life OS app. You'll be taken back to it afterwards."}
            {handedOff ? (
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => {
                  window.location.href = handedOff;
                }}
              >
                Open Life OS
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="system-card p-6">
          <Tabs
            value={mode === "reset" ? "signin" : mode}
            onValueChange={(v) => setMode(v as Mode)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Sign up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>

          {mode !== "reset" && (
            <div className="mt-5 space-y-2">
              {useGis ? (
                <GoogleIdentityButton
                  onError={(error, unavailable) => {
                    if (unavailable) setGisFailed(true);
                    else toast.error(error.message);
                  }}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => signInWith("google")}
                >
                  <GoogleMark />
                  Continue with Google
                </Button>
              )}
              <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or with email
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {mode !== "reset" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  // Only new passwords need 8+; older accounts may use shorter ones.
                  {...(mode === "signup" ? { minLength: 8 } : {})}
                  aria-describedby={mode === "signup" ? "password-hint" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "signup" ? (
                  <p id="password-hint" className="text-xs text-muted-foreground">
                    At least 8 characters. A short phrase is easier to remember.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                We'll email you a link to choose a new password.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
            >
              {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Google's own button (Google Identity Services). Each attempt gets a fresh
 * nonce: Google signs its hash into the ID token, Supabase checks the raw
 * value. `unavailable` means the script couldn't load, so the page falls
 * back to the redirect flow.
 */
function GoogleIdentityButton({
  onError,
}: {
  onError: (error: Error, unavailable?: boolean) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const report = useRef(onError);
  report.current = onError;

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const id = await loadGoogleIdentity();
      const nonce = await makeNonce();
      const parent = slot.current;
      if (cancelled || !parent || !GOOGLE_CLIENT_ID) return;
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: nonce.hashed,
        use_fedcm_for_button: true,
        callback: async ({ credential }) => {
          if (!credential) {
            report.current(new Error("Google didn't return a sign-in. Please try again."));
            return;
          }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: nonce.raw,
          });
          if (error) {
            report.current(new Error(`Google sign-in didn't finish: ${error.message}`));
            // A nonce is good for one try; set up a fresh one.
            if (!cancelled) void setup().catch(() => undefined);
          }
          // Success: onAuthStateChange on the page takes it from here.
        },
      });
      parent.replaceChildren();
      const dark = document.documentElement.classList.contains("dark");
      id.renderButton(parent, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        // The page is in English; Google would otherwise follow the browser language.
        locale: "en",
        width: Math.min(400, Math.max(200, parent.offsetWidth || 320)),
      });
      setReady(true);
    }
    setup().catch((error: unknown) => {
      if (!cancelled) {
        report.current(error instanceof Error ? error : new Error(String(error)), true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex min-h-10 w-full justify-center">
      <div ref={slot} className="flex w-full justify-center" />
      {ready ? null : (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse rounded-full border border-border bg-muted/40"
        />
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1A11.99 11.99 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1C6.24 6.87 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
