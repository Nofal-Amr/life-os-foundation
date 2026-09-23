import { describe, expect, it } from "vitest";

import { handoffUrl, makeNonce, sha256Hex } from "./googleIdentity";

describe("nonce", () => {
  it("hashes with SHA-256 as hex", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("gives Google the hash of what Supabase gets, fresh each time", async () => {
    const first = await makeNonce();
    const second = await makeNonce();
    expect(first.hashed).toBe(await sha256Hex(first.raw));
    expect(first.raw).not.toBe(second.raw);
    expect(first.raw).toMatch(/^[A-Za-z0-9]{30,}$/);
  });
});

describe("handoffUrl", () => {
  it("returns the session to the app in the fragment, not the query", () => {
    const url = handoffUrl({
      access_token: "a.b.c",
      refresh_token: "r1",
      expires_in: 3600,
      expires_at: 1790000000,
      token_type: "bearer",
    });
    expect(url.startsWith("lifeos://auth-callback#")).toBe(true);
    expect(url).not.toContain("?");
    const params = new URLSearchParams(url.split("#")[1]);
    expect(params.get("access_token")).toBe("a.b.c");
    expect(params.get("refresh_token")).toBe("r1");
    expect(params.get("expires_in")).toBe("3600");
    expect(params.get("expires_at")).toBe("1790000000");
  });
});
