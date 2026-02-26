// app/lib/session.ts
import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";

function hmac(input: string) {
  return crypto.createHmac("sha256", SECRET).update(input).digest("hex");
}

export function makeSessionToken(userId: string) {
  const ts = Date.now().toString();
  const base = `${userId}.${ts}`;
  const sig = hmac(base);
  return `${base}.${sig}`;
}

export function verifySessionToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, ts, sig] = parts;
  const base = `${userId}.${ts}`;
  const expected = hmac(base);

  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return { userId, ts: Number(ts) };
}