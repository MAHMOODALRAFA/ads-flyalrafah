import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";

export function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function makeSessionToken(userId: string) {
  const ts = Date.now().toString();
  const base = `${userId}.${ts}`;
  const sig = sign(base);
  return `${base}.${sig}`;
}

export function verifySessionToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, ts, sig] = parts;
  const base = `${userId}.${ts}`;
  const expected = sign(base);

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  return { userId, ts: Number(ts) };
}