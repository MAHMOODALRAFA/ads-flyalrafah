// app/lib/referral.ts
"use client";

/**
 * ✅ IMPORTANT:
 * Session (cookie) is the SOURCE OF TRUTH (server).
 * This file is only for lightweight client-side guards / UX markers.
 * We keep legacy keys for backward compatibility, but DO NOT invent server data here.
 */

// legacy-only (do not generate new values here)
const REF_CODE_KEY = "flyalrafah_ref_code";
const SHARE_COUNT_KEY = "flyalrafah_share_count";
const DISCOUNT_KEY = "flyalrafah_discount_code";

// current UX markers
const PHONE_KEY = "flyalrafah_phone";
const STARTED_AT_KEY = "flyalrafah_started_at";

// ✅ Align with server cookie lifetime (14 days)
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// soft anti-tamper
const DEVICE_ID_KEY = "flyalrafah_device_id";
const SIG_SUFFIX = "__sig";
const SECRET = "flyalrafah_v1_secret_2026";

// share logic (server uses sharesGiven; local shareCount is legacy)
export const REQUIRED_SHARES = 5;

// ✅ Align with server cooldown (60s)
const LAST_SHARE_TS_KEY = "flyalrafah_last_share_ts";
const SHARE_COOLDOWN_MS = 60_000;

// questions (per phone)
const QA_DONE_PREFIX = "flyalrafah_questions_done__";

// UX helpers for flow
const WA_PENDING_SHARE_KEY = "wa_pending_share";
const ENTRY_CONFIRMED_KEY = "entry_confirmed";

/** -------------------- small helpers -------------------- */

function safeWindow(): boolean {
  return typeof window !== "undefined";
}

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

/** -------------------- device id + signing -------------------- */

function getOrCreateDeviceId(): string {
  if (!safeWindow()) return "server";

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
  if (!safeWindow()) return fallback;

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
  if (!safeWindow()) return;
  localStorage.setItem(key, value);
  localStorage.setItem(sigKey(key), sign(key, value));
}

function removeSigned(key: string) {
  if (!safeWindow()) return;
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

/** -------------------- phone normalization (UI-only) -------------------- */

export function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return String(input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

/**
 * Returns ONLY digits (no "+"). Good for your API usage.
 */
export function phoneDigitsOnly(input: string) {
  return normalizeDigits(String(input || "")).replace(/[^\d]/g, "");
}

/** -------------------- phone + local started marker -------------------- */

export function setPhone(phone: string) {
  const digits = phoneDigitsOnly(phone);
  if (!digits) return;
  writeSigned(PHONE_KEY, digits);
  touchSession();
}

export function getPhone(): string {
  const v = readSigned(PHONE_KEY, "");
  if (v === "__TAMPERED__") {
    removeSigned(PHONE_KEY);
    return "";
  }
  return v;
}

/**
 * ✅ hasStarted = local UX marker only.
 * If local is cleared but cookie exists, /start should forward user using /api/check.
 */
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
    // ✅ reset local markers only
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

  writeSigned(qaKeyForPhone(phone), "1");
}

export function resetQuestionsAnswered() {
  const phone = readSigned(PHONE_KEY, "");
  if (!phone || phone === "__TAMPERED__") return;
  removeSigned(qaKeyForPhone(phone));
}

/** -------------------- legacy ref code (read-only) -------------------- */

/**
 * ✅ IMPORTANT:
 * In the new system, refCode must come from DB (/api/check).
 * This is legacy-only and will NOT generate random ref codes.
 */
export function getRefCode(): string {
  if (!safeWindow()) return "XXXX";

  const saved = readSigned(REF_CODE_KEY, "");
  if (saved === "__TAMPERED__") {
    removeSigned(REF_CODE_KEY);
    return "XXXX";
  }

  return saved || "XXXX";
}

export function resetRefCode() {
  removeSigned(REF_CODE_KEY);
}

/** -------------------- legacy local share count (demo-only) -------------------- */

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
  if (!safeWindow()) return true;

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
  // legacy only (server uses sharesGiven)
  return getShareCount() >= REQUIRED_SHARES;
}

/** -------------------- legacy discount exports (kept) -------------------- */

export function makeCoupon(code: string) {
  const safe = (code || "XXXX").toUpperCase().slice(0, 6);
  return `FLY-${safe}`;
}

function makeDiscountCode() {
  return `FLY-${randomCode(6)}`;
}

export function getOrCreateDiscountCode(): string {
  if (!safeWindow()) return "FLY-XXXXXX";

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
  return 0;
}

/** -------------------- UX helpers (for your flow pages) -------------------- */

export function setPendingShare() {
  if (!safeWindow()) return;
  sessionStorage.setItem(WA_PENDING_SHARE_KEY, "1");
}

export function consumePendingShare(): boolean {
  if (!safeWindow()) return false;
  const pending = sessionStorage.getItem(WA_PENDING_SHARE_KEY) === "1";
  if (pending) sessionStorage.removeItem(WA_PENDING_SHARE_KEY);
  return pending;
}

export function setEntryConfirmed() {
  if (!safeWindow()) return;
  sessionStorage.setItem(ENTRY_CONFIRMED_KEY, "1");
}

export function consumeEntryConfirmed(): boolean {
  if (!safeWindow()) return false;
  const v = sessionStorage.getItem(ENTRY_CONFIRMED_KEY) === "1";
  if (v) sessionStorage.removeItem(ENTRY_CONFIRMED_KEY);
  return v;
}

export function buildWhatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** -------------------- optional: verify legacy bits or reset -------------------- */

export function verifyReferralOrReset(): {
  tampered: boolean;
  refCode: string;
  shareCount: number;
} {
  if (!safeWindow()) return { tampered: false, refCode: "", shareCount: 0 };

  const rc = readSigned(REF_CODE_KEY, "");
  const sc = readSigned(SHARE_COUNT_KEY, "0");

  const tampered = rc === "__TAMPERED__" || sc === "__TAMPERED__";
  if (tampered) {
    resetRefCode();
    resetShareCount();
    resetDiscountCode();
    removeSigned(LAST_SHARE_TS_KEY);
  }

  return { tampered, refCode: getRefCode(), shareCount: getShareCount() };
}

/** -------------------- full reset (local only) -------------------- */

export function resetAll() {
  // ✅ capture phone BEFORE removing it
  const phone = readSigned(PHONE_KEY, "");

  removeSigned(PHONE_KEY);
  removeSigned(STARTED_AT_KEY);

  removeSigned(REF_CODE_KEY);
  removeSigned(SHARE_COUNT_KEY);
  removeSigned(DISCOUNT_KEY);
  removeSigned(LAST_SHARE_TS_KEY);

  if (phone && phone !== "__TAMPERED__") {
    removeSigned(qaKeyForPhone(phone));
  }

  // optional:
  // localStorage.removeItem(DEVICE_ID_KEY);
}