import { describe, expect, it } from "vitest";

import { newNonce, SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("adds every security header and keeps status and body", async () => {
    const response = withSecurityHeaders(
      new Response("hello", { status: 404, headers: { "content-type": "text/plain" } }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("hello");
    expect(response.headers.get("content-type")).toBe("text/plain");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("does not override a header the app already set", () => {
    const response = withSecurityHeaders(
      new Response(null, { headers: { "Referrer-Policy": "no-referrer" } }),
    );
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("script policy", () => {
  it("gives pages a nonce-based script policy", () => {
    const response = withSecurityHeaders(
      new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } }),
      "abc123",
    );
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("script-src 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("leaves non-page responses and nonce-less ones with the base policy", () => {
    const json = withSecurityHeaders(
      new Response("{}", { headers: { "content-type": "application/json" } }),
      "abc123",
    );
    expect(json.headers.get("Content-Security-Policy")).toBe(
      SECURITY_HEADERS["Content-Security-Policy"],
    );
    const page = withSecurityHeaders(
      new Response("<html></html>", { headers: { "content-type": "text/html" } }),
    );
    expect(page.headers.get("Content-Security-Policy")).not.toContain("script-src");
  });

  it("makes a different nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce().length).toBeGreaterThanOrEqual(22);
  });
});
