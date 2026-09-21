import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Life OS" },
      { name: "description", content: "Sign in to your private Life OS workspace." },
      { property: "og:title", content: "Sign in — Life OS" },
      { property: "og:description", content: "Sign in to your private Life OS workspace." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

/** Set by mobile/android MainActivity on its WebView user agent. */
const ANDROID_APP_UA = "LifeOSAndroid";
const ANDROID_CALLBACK = "lifeos://auth-callback";

/** Asks Supabase whether a provider is enabled, so users never land on a raw error page. */
async function providerEnabled(provider: "google" | "apple"): Promise<boolean> {
  try {
    const client = supabase as unknown as { supabaseUrl: string | URL; supabaseKey: string };
    const response = await fetch(`${String(client.supabaseUrl).replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: client.supabaseKey },
    });
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.[provider] === true;
  } catch {
    return true; // Let Supabase report the problem.
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // getSession works offline; it also picks up a session returned by Google/Apple.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function signInWith(provider: "google" | "apple") {
    setPending(true);
    try {
      if (!(await providerEnabled(provider))) {
        toast.message(`${provider === "google" ? "Google" : "Apple"} sign-in isn't switched on yet. Use email for now.`);
        setPending(false);
        return;
      }
      // The Android app can't show Google's sign-in inside its WebView, so the
      // provider opens in the phone's browser and returns via lifeos://.
      const inApp = navigator.userAgent.includes(ANDROID_APP_UA);
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
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
        const { data } = await supabase.auth.getUser();
        if (data.user) navigate({ to: "/dashboard", replace: true });
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
          <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your calm, private space for projects, habits and reflection.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
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
              <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => signInWith("google")}>
                <GoogleMark />
                Continue with Google
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => signInWith("apple")}>
                <AppleMark />
                Continue with Apple
              </Button>
              <div className="flex items-center gap-3 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1C6.24 6.87 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.64c-.02-2.33 1.9-3.45 1.99-3.5-1.08-1.59-2.77-1.8-3.37-1.83-1.43-.15-2.8.84-3.52.84-.73 0-1.85-.82-3.04-.8a4.5 4.5 0 0 0-3.8 2.31c-1.63 2.82-.42 7 1.17 9.29.78 1.12 1.7 2.38 2.9 2.33 1.17-.05 1.61-.75 3.02-.75 1.4 0 1.8.75 3.03.73 1.26-.02 2.05-1.14 2.81-2.27.89-1.3 1.25-2.56 1.27-2.63-.03-.01-2.43-.93-2.46-3.72ZM14.1 5.8c.64-.78 1.08-1.85.96-2.93-.92.04-2.05.62-2.71 1.39-.59.69-1.12 1.8-.98 2.85 1.03.08 2.08-.52 2.73-1.3Z" />
    </svg>
  );
}
