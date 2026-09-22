import { describe, expect, it } from "vitest";

import { SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";

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
