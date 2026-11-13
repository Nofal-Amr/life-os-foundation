import { describe, expect, it } from "vitest";

import { DEFAULT_REDIRECT_URI, buildConsentUrl, hasNeededScopes, readGoogleConfig } from "./oauth";

describe("readGoogleConfig", () => {
  it("is null until all three server variables exist", () => {
    expect(readGoogleConfig({})).toBeNull();
    expect(readGoogleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toBeNull();
    expect(
      readGoogleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", GOOGLE_TOKEN_KEY: "k" }),
    ).toEqual({ clientId: "id", clientSecret: "s", tokenKey: "k", redirectUri: DEFAULT_REDIRECT_URI });
  });
});

describe("buildConsentUrl", () => {
  it("asks only for the narrow calendar scopes, offline, with PKCE", () => {
    const url = new URL(
      buildConsentUrl({ clientId: "id", redirectUri: DEFAULT_REDIRECT_URI, state: "st", codeChallenge: "ch" }),
    );
    const scope = url.searchParams.get("scope")!;
    expect(scope).toContain("calendar.events");
    expect(scope).toContain("calendar.calendarlist.readonly");
    expect(scope.split(" ")).not.toContain("https://www.googleapis.com/auth/calendar");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

describe("hasNeededScopes", () => {
  it("notices when someone unticks calendar access", () => {
    expect(hasNeededScopes("openid email")).toBe(false);
    expect(
      hasNeededScopes(
        "email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ),
    ).toBe(true);
  });
});
