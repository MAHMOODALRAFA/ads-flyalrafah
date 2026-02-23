// app/lib/referral.ts
"use client";

const REF_CODE_KEY = "flyalrafah_ref_code";
const SHARE_COUNT_KEY = "flyalrafah_share_count";
const PHONE_KEY = "flyalrafah_phone";

/**
 * ✅ Discount concept removed from UI.
 * ⚠️ Kept keys/functions for backward compatibility (in case other pages still import them).
 */
const DISCOUNT_KEY = "flyalrafah_discount_code"; // legacy

// session
const STARTED_AT_KEY = "flyalrafah_started_at";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour (sliding)

// anti-tamper (soft)
const DEVICE_ID_KEY = "flyalrafah_device_id";
const SIG_SUFFIX = "__sig";
const SECRET = "flyalrafah_v1_secret_2026";

// share logic
export const REQUIRED_SHARES = 5; // ✅ user wants 5 friends (demo stages)

// cooldown (optional)
const LAST_SHARE_TS_KEY = "flyalrafah_last_share_ts";
const SHARE_COOLDOWN_MS = 20_000;

// questions (1-time per phone)
const QA_DONE_PREFIX = "flyalrafah_questions_done__";

/** -------------------- helpers -------------------- */

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// FNV-1a 32-bit -> base36
function fnv1a32(str: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const saved = localStorage.getItem(DEVICE_ID_KEY);
  if (saved) return saved;

  const id = `dev_${randomCode(10)}_${Date.now().toString(36)}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getDeviceId(): string {
  return getOrCreateDeviceId();
}

function sign(key: string, value: string) {
  const deviceId = getOrCreateDeviceId();
  return fnv1a32(`${SECRET}|${deviceId}|${key}|${value}`);
}

function sigKey(key: string) {
  return `${key}${SIG_SUFFIX}`;
}

function readSigned(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  const savedSig = localStorage.getItem(sigKey(key));

  // migrate: if no signature existed before
  if (!savedSig) {
    localStorage.setItem(sigKey(key), sign(key, raw));
    return raw;
  }

  const expected = sign(key, raw);
  if (expected !== savedSig) return "__TAMPERED__";

  return raw;
}

function writeSigned(key: string, value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
  localStorage.setItem(sigKey(key), sign(key, value));
}

function removeSigned(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  localStorage.removeItem(sigKey(key));
}

function nowMs() {
  return Date.now();
}

function isExpired(startedAtMs: number) {
  if (!startedAtMs) return false;
  return nowMs() - startedAtMs > SESSION_TTL_MS;
}

function touchSession() {
  writeSigned(STARTED_AT_KEY, String(nowMs()));
}

/** -------------------- phone + session -------------------- */

export function setPhone(phone: string) {
  writeSigned(PHONE_KEY, phone);
  touchSession();
}

export function getPhone(): string {
  if (!hasStarted()) return "";
  const v = readSigned(PHONE_KEY, "");
  if (v === "__TAMPERED__") {
    removeSigned(PHONE_KEY);
    return "";
  }
  return v;
}

export function hasStarted(): boolean {
  const phone = readSigned(PHONE_KEY, "");
  if (!phone || phone === "__TAMPERED__") {
    if (phone === "__TAMPERED__") removeSigned(PHONE_KEY);
    return false;
  }

  const startedAtRaw = readSigned(STARTED_AT_KEY, "0");
  if (startedAtRaw === "__TAMPERED__") {
    resetAll();
    return false;
  }

  const startedAt = Number(startedAtRaw || "0");

  // backward compatible: if missing startedAt, create it
  if (!startedAt) {
    touchSession();
    return true;
  }

  if (isExpired(startedAt)) {
    resetAll();
    return false;
  }

  // sliding session
  touchSession();
  return true;
}

/** -------------------- questions (1-time per phone) -------------------- */

function qaKeyForPhone(phone: string) {
  return `${QA_DONE_PREFIX}${phone || "unknown"}`;
}

export function hasAnsweredQuestions(): boolean {
  if (!hasStarted()) return false;
  const phone = getPhone();
  if (!phone) return false;

  const key = qaKeyForPhone(phone);
  const v = readSigned(key, "0");
  if (v === "__TAMPERED__") {
    removeSigned(key);
    return false;
  }
  return v === "1";
}

export function markQuestionsAnswered() {
  if (!hasStarted()) return;
  const phone = getPhone();
  if (!phone) return;
  const key = qaKeyForPhone(phone);
  writeSigned(key, "1");
}

export function resetQuestionsAnswered() {
  const phone = readSigned(PHONE_KEY, "");
  if (!phone || phone === "__TAMPERED__") return;
  removeSigned(qaKeyForPhone(phone));
}

/** -------------------- ref code -------------------- */

export function getRefCode(): string {
  if (typeof window === "undefined") return "XXXX";

  const saved = readSigned(REF_CODE_KEY, "");
  if (saved === "__TAMPERED__") {
    removeSigned(REF_CODE_KEY);
    return "XXXX";
  }
  if (saved) return saved;

  const code = randomCode(6);
  writeSigned(REF_CODE_KEY, code);
  return code;
}

export function resetRefCode() {
  removeSigned(REF_CODE_KEY);
}

/** -------------------- local share count (legacy/demo) -------------------- */

export function getShareCount(): number {
  const v = readSigned(SHARE_COUNT_KEY, "0");
  if (v === "__TAMPERED__") {
    writeSigned(SHARE_COUNT_KEY, "0");
    return 0;
  }
  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

export function setShareCount(count: number): number {
  const next = Math.max(0, Math.floor(count));
  writeSigned(SHARE_COUNT_KEY, String(next));
  return next;
}

export function canIncreaseShareNow(): boolean {
  if (typeof window === "undefined") return true;

  const v = readSigned(LAST_SHARE_TS_KEY, "0");
  if (v === "__TAMPERED__") {
    writeSigned(LAST_SHARE_TS_KEY, "0");
    return true;
  }

  const last = Number(v || "0");
  return Date.now() - last >= SHARE_COOLDOWN_MS;
}

export function markShareNow() {
  writeSigned(LAST_SHARE_TS_KEY, String(Date.now()));
}

export function increaseShareCount(): number {
  // optional cooldown
  if (!canIncreaseShareNow()) return getShareCount();

  const next = getShareCount() + 1;
  writeSigned(SHARE_COUNT_KEY, String(next));
  markShareNow();
  return next;
}

export function resetShareCount() {
  writeSigned(SHARE_COUNT_KEY, "0");
}

export function isUnlocked(): boolean {
  return getShareCount() >= REQUIRED_SHARES;
}

/** -------------------- legacy discount exports (no longer used) -------------------- */

export function makeCoupon(code: string) {
  const safe = (code || "XXXX").toUpperCase().slice(0, 6);
  return `FLY-${safe}`;
}

function makeDiscountCode() {
  return `FLY-${randomCode(6)}`;
}

export function getOrCreateDiscountCode(): string {
  // legacy only
  if (typeof window === "undefined") return "FLY-XXXXXX";

  const saved = readSigned(DISCOUNT_KEY, "");
  if (saved === "__TAMPERED__") {
    removeSigned(DISCOUNT_KEY);
  } else if (saved) {
    return saved.toUpperCase();
  }

  const code = makeDiscountCode();
  writeSigned(DISCOUNT_KEY, code);
  return code;
}

export function resetDiscountCode() {
  removeSigned(DISCOUNT_KEY);
}

export function computeDiscountAmount(_shareCount: number): number {
  // legacy only (discount removed)
  return 0;
}

/** -------------------- optional: verify all or reset -------------------- */

export function verifyReferralOrReset(): {
  tampered: boolean;
  refCode: string;
  shareCount: number;
} {
  if (typeof window === "undefined")
    return { tampered: false, refCode: "", shareCount: 0 };

  const rc = readSigned(REF_CODE_KEY, "");
  const sc = readSigned(SHARE_COUNT_KEY, "0");

  const tampered = rc === "__TAMPERED__" || sc === "__TAMPERED__";
  if (tampered) {
    // reset only referral bits
    resetRefCode();
    resetShareCount();
    resetDiscountCode();
    removeSigned(LAST_SHARE_TS_KEY);
  }

  return { tampered, refCode: getRefCode(), shareCount: getShareCount() };
}

/** -------------------- full reset -------------------- */

export function resetAll() {
  removeSigned(PHONE_KEY);
  removeSigned(STARTED_AT_KEY);

  removeSigned(REF_CODE_KEY);
  removeSigned(SHARE_COUNT_KEY);
  removeSigned(DISCOUNT_KEY);
  removeSigned(LAST_SHARE_TS_KEY);

  // questions flag
  const phone = readSigned(PHONE_KEY, "");
  if (phone && phone !== "__TAMPERED__") {
    removeSigned(qaKeyForPhone(phone));
  }

  // optional:
  // localStorage.removeItem(DEVICE_ID_KEY);
}