/**
 * Headers added to every server response. Kept deliberately conservative so
 * nothing the app needs is blocked:
 * - no framing by other sites (clickjacking),
 * - no MIME sniffing,
 * - no <base> or plugin injection,
 * - only this site's origin in the Referer sent to other sites,
 * - camera, microphone and payment off; location only for this site
 *   (prayer times use it).
 * Scripts are not restricted by CSP here: the app ships an inline theme
 * script and hydration data, and a script policy would need nonces.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), payment=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

/** A copy of the response with the security headers set (existing ones win). */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
