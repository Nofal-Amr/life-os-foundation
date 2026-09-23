/**
 * "Sign in with Google" without the Supabase redirect.
 *
 * Google Identity Services (GIS) hands the page an ID token directly, and
 * Supabase verifies it with signInWithIdToken. Nothing navigates through
 * *.supabase.co, so Google's sign-in window names this site instead.
 *
 * - A nonce ties each token to one attempt: Google gets its SHA-256 hash,
 *   Supabase gets the raw value and checks they match, so a captured token
 *   can't be replayed.
 * - Google doesn't allow its button inside app WebViews, so the Android app
 *   opens this site's /auth page in the phone's browser; after sign-in the
 *   session goes back to the app through lifeos://auth-callback, the same
 *   door the redirect flow already used.
 */

/** Public by design: it names the app to Google, it doesn't authorise anything. */
export const GOOGLE_CLIENT_ID =
  (import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined)?.trim() || undefined;

/** Where the Android app sends Google sign-in (a real origin Google accepts). */
export const WEB_ORIGIN = "https://lifeos0.vercel.app";
export const ANDROID_CALLBACK = "lifeos://auth-callback";
/** Query flag on /auth meaning "sign in here, then return to the app". */
export const HANDOFF_PARAM = "handoff";

type CredentialResponse = { credential?: string };
type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_button?: boolean;
    itp_support?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
};
type GoogleGlobal = { accounts: { id: GoogleAccountsId } };

let loading: Promise<GoogleAccountsId> | null = null;

/** Loads Google's script once; rejects if it can't load (offline, blocked). */
export function loadGoogleIdentity(timeoutMs = 10_000): Promise<GoogleAccountsId> {
  const existing = (window as { google?: GoogleGlobal }).google;
  if (existing?.accounts?.id) return Promise.resolve(existing.accounts.id);
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const timer = window.setTimeout(
      () => fail(new Error("Google sign-in took too long to load.")),
      timeoutMs,
    );
    function fail(error: Error) {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(error);
    }
    script.onload = () => {
      window.clearTimeout(timer);
      const id = (window as { google?: GoogleGlobal }).google?.accounts?.id;
      if (id) resolve(id);
      else fail(new Error("Google sign-in didn't start."));
    };
    script.onerror = () => fail(new Error("Couldn't reach Google. Check your connection."));
    document.head.appendChild(script);
  });
  return loading;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A fresh nonce: `raw` goes to Supabase, `hashed` to Google. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  return { raw, hashed: await sha256Hex(raw) };
}

/**
 * The deep link that gives a session to the Android app, in the fragment
 * format Supabase's own redirect used (the app's /auth page reads it).
 */
export function handoffUrl(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}): string {
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    token_type: session.token_type,
  });
  if (session.expires_at) params.set("expires_at", String(session.expires_at));
  return `${ANDROID_CALLBACK}#${params.toString()}`;
}
