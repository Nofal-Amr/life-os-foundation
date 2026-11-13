import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { openToken, sealToken, signState, verifyState } from "./secrets.server";

const key = randomBytes(32).toString("base64");
const other = randomBytes(32).toString("base64");

describe("sealed refresh tokens", () => {
  it("open again with the same key and user", () => {
    const sealed = sealToken("1//refresh-token", "user-a", key);
    expect(sealed).not.toContain("refresh-token");
    expect(openToken(sealed, "user-a", key)).toBe("1//refresh-token");
  });
  it("refuse to open for another user or with another key", () => {
    const sealed = sealToken("1//refresh-token", "user-a", key);
    expect(() => openToken(sealed, "user-b", key)).toThrow();
    expect(() => openToken(sealed, "user-a", other)).toThrow();
  });
  it("refuse a key that isn't 32 bytes", () => {
    expect(() => sealToken("x", "u", Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("signed OAuth state", () => {
  it("is accepted for the same user before it expires", () => {
    const now = Date.now();
    const state = signState("user-a", key, now);
    expect(verifyState(state, "user-a", key, now + 60_000)).toBe(true);
  });
  it("is refused for another user, after 10 minutes, or when tampered with", () => {
    const now = Date.now();
    const state = signState("user-a", key, now);
    expect(verifyState(state, "user-b", key, now)).toBe(false);
    expect(verifyState(state, "user-a", key, now + 11 * 60_000)).toBe(false);
    expect(verifyState(state, "user-a", other, now)).toBe(false);
    const [payload, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user-b", n: "x", e: now + 60_000 })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`, "user-b", key, now)).toBe(false);
    expect(verifyState(`${payload}.`, "user-a", key, now)).toBe(false);
  });
});
