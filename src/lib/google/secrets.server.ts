/**
 * Server-only secrets for Google Calendar sync.
 *
 * - Refresh tokens are sealed with AES-256-GCM before they reach the database.
 *   The user id is the associated data, so a sealed token only opens for the
 *   account it was made for.
 * - The OAuth `state` is HMAC-signed: user id, a random nonce and an expiry.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";

function keyBytes(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function sealToken(plain: string, userId: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyB64), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

export function openToken(sealed: string, userId: string, keyB64: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unreadable stored token");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyB64), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

const STATE_TTL_MS = 10 * 60_000;

function hmac(data: string, keyB64: string) {
  // A separate purpose label so the state key is never the encryption key itself.
  return createHmac("sha256", keyBytes(keyB64)).update(`state:${data}`).digest("base64url");
}

export function signState(userId: string, keyB64: string, nowMs = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({
      u: userId,
      n: randomBytes(16).toString("base64url"),
      e: nowMs + STATE_TTL_MS,
    }),
  ).toString("base64url");
  return `${payload}.${hmac(payload, keyB64)}`;
}

/** True only for a state this server signed, for this user, not yet expired. */
export function verifyState(
  state: string,
  userId: string,
  keyB64: string,
  nowMs = Date.now(),
): boolean {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(hmac(payload, keyB64));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string;
      e?: number;
    };
    return data.u === userId && typeof data.e === "number" && data.e > nowMs;
  } catch {
    return false;
  }
}
