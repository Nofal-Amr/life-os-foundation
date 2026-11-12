/**
 * Headers added to every server response:
 * - no framing by other sites (clickjacking),
 * - no MIME sniffing,
 * - no <base> or plugin injection,
 * - only this site's origin in the Referer sent to other sites,
 * - camera, microphone and payment off; location only for this site
 *   (prayer times use it),
 * - on pages, a script policy: only scripts carrying this response's nonce
 *   run, plus what those scripts load themselves ('strict-dynamic'). An
 *   injected <script> or inline handler has no nonce, so it can't run.
 */
const BASE_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": BASE_CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

/**
 * The page policy for one response. 'self' and https: are ignored by browsers
 * that understand 'strict-dynamic' and only help very old ones. WebAssembly
 * (on-device text reading) needs 'wasm-unsafe-eval'; its workers come from
 * this site or blob: URLs.
 */
export function pageCsp(nonce: string): string {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' 'self' https:`,
    "worker-src 'self' blob:",
    BASE_CSP,
  ].join("; ");
}

/** A fresh, unguessable nonce for one response. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * A copy of the response with the security headers set (existing ones win).
 * With a nonce, HTML pages get the script policy for that nonce.
 */
export function withSecurityHeaders(response: Response, nonce?: string): Response {
  const headers = new Headers(response.headers);
  const isPage = (headers.get("content-type") ?? "").includes("text/html");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (headers.has(name)) continue;
    headers.set(
      name,
      name === "Content-Security-Policy" && nonce && isPage ? pageCsp(nonce) : value,
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
