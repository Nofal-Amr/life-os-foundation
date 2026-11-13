/** Google OAuth pieces with no secrets: scopes, the consent URL, config checks. */

/** The fewest scopes that let sync work. Never the full `calendar` scope. */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export const DEFAULT_REDIRECT_URI = "https://lifeos0.vercel.app/google-calendar/callback";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  tokenKey: string;
  redirectUri: string;
};

/** Reads the server's environment; null means "Not set up yet". */
export function readGoogleConfig(env: Record<string, string | undefined>): GoogleConfig | null {
  const clientId = env["GOOGLE_CLIENT_ID"]?.trim();
  const clientSecret = env["GOOGLE_CLIENT_SECRET"]?.trim();
  const tokenKey = env["GOOGLE_TOKEN_KEY"]?.trim();
  if (!clientId || !clientSecret || !tokenKey) return null;
  return {
    clientId,
    clientSecret,
    tokenKey,
    redirectUri: env["GOOGLE_REDIRECT_URI"]?.trim() || DEFAULT_REDIRECT_URI,
  };
}

export function buildConsentUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string | undefined;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  // offline + consent: Google returns a refresh token every time we connect.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (opts.loginHint) url.searchParams.set("login_hint", opts.loginHint);
  return url.toString();
}

/** True when every scope sync needs was granted (people can untick some). */
export function hasNeededScopes(granted: string): boolean {
  const set = new Set(granted.split(/\s+/));
  return (
    set.has("https://www.googleapis.com/auth/calendar.events") &&
    set.has("https://www.googleapis.com/auth/calendar.calendarlist.readonly")
  );
}
