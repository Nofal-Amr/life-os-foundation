import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { challengeFor, createPkcePair } from "./pkce";

describe("PKCE", () => {
  it("is the base64url SHA-256 of the verifier (S256)", async () => {
    const verifier = "dBjftJeZ4CVP-mJ92IZvsWvAQ7uImH7CwqZSJpjGN6M";
    expect(await challengeFor(verifier)).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
  });
  it("makes a fresh 43-character verifier each time", async () => {
    const a = await createPkcePair();
    const b = await createPkcePair();
    expect(a.verifier).toHaveLength(43);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).toBe(createHash("sha256").update(a.verifier).digest("base64url"));
  });
});
