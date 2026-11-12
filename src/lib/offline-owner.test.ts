import { describe, expect, it } from "vitest";

import { replaysAs, userFromAuthorization } from "./offline";

const jwt = (payload: object) =>
  `Bearer h.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;

describe("userFromAuthorization", () => {
  it("reads the signed-in user's id from the bearer token", () => {
    expect(userFromAuthorization(jwt({ sub: "user-a", role: "authenticated" }))).toBe("user-a");
  });

  it("is empty when signed out (the anon key has no user)", () => {
    expect(userFromAuthorization(jwt({ role: "anon" }))).toBe("");
    expect(userFromAuthorization(null)).toBe("");
    expect(userFromAuthorization("Bearer not-a-jwt")).toBe("");
  });
});

describe("replaysAs", () => {
  it("sends a queued change only with its own user's session", () => {
    expect(replaysAs({ user: "user-a" }, "user-a")).toBe(true);
    expect(replaysAs({ user: "user-a" }, "user-b")).toBe(false);
  });

  it("never sends anything while signed out", () => {
    expect(replaysAs({ user: "user-a" }, "")).toBe(false);
    expect(replaysAs({}, "")).toBe(false);
  });

  it("lets changes queued before owners were kept go with whoever is signed in", () => {
    expect(replaysAs({}, "user-b")).toBe(true);
  });
});
