// app/lib/referral.ts

const REF_CODE_KEY = "flyalrafah_ref_code";
const SHARE_COUNT_KEY = "flyalrafah_share_count";
const PHONE_KEY = "flyalrafah_phone";
const DISCOUNT_KEY = "flyalrafah_discount_code";

// ✅ Session TTL
const STARTED_AT_KEY = "flyalrafah_started_at";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// ✅ امضا: کلیدهای داخلی
const DEVICE_ID_KEY = "flyalrafah_device_id";
const SIG_SUFFIX = "__sig";

// ✅ عدد ثابت فلو
export const REQUIRED_SHARES = 3;

/**
 * ⚠️ امنیت نرم (anti-tamper)
 * secret داخل فرانت است، ولی برای جلوگیری از دستکاری ساده localStorage خوبه
 */
const SECRET = "flyalrafah_v1_secret_2026";

/** -------------------- Utils -------------------- */

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ✅ FNV-1a 32-bit (بدون BigInt) -> base36
function fnv1a32(str: string) {
  let hash = 0x811c9dc5; // offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // prime
  }
  // unsigned 32-bit
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

function sign(key: string, value: string) {
  const deviceId = getOrCreateDeviceId();
  const payload = `${SECRET}|${deviceId}|${key}|${value}`;
  return fnv1a32(payload);
}

function sigKey(key: string) {
  return `${key}${SIG_SUFFIX}`;
}

function readSigned(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  const savedSig = localStorage.getItem(sigKey(key));

  // ✅ migrate اگر قبلاً بدون امضا ذخیره شده بود
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
  // Sliding session: هر بار استفاده، تمدید
  writeSigned(STARTED_AT_KEY, String(nowMs()));
}

/** -------------------- Phone + Session -------------------- */

export function getPhone(): string {
  // ✅ اگر سشن منقضی شد → خروج
  if (!hasStarted()) return "";

  const v = readSigned(PHONE_KEY, "");
  if (v === "__TAMPERED__") {
    removeSigned(PHONE_KEY);
    return "";
  }
  return v;
}

export function setPhone(phone: string) {
  writeSigned(PHONE_KEY, phone);
  touchSession(); // ✅ شروع/تمدید سشن
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

  // ✅ سازگاری با داده‌های قدیمی: اگر startedAt نداریم، بساز
  if (!startedAt) {
    touchSession();
    return true;
  }

  if (isExpired(startedAt)) {
    resetAll();
    return false;
  }

  // ✅ Sliding تمدید
  touchSession();
  return true;
}

/** -------------------- Ref Code -------------------- */

export function getRefCode(): string {
  if (typeof window === "undefined") return "XXXX";

  const saved = readSigned(REF_CODE_KEY, "");
  if (saved === "__TAMPERED__") {
    removeSigned(REF_CODE_KEY);
    return "XXXX";
  }

  if (saved) return saved;

  const code = randomCode(5);
  writeSigned(REF_CODE_KEY, code);
  return code;
}

export function resetRefCode() {
  removeSigned(REF_CODE_KEY);
}

/** -------------------- Share Count -------------------- */

export function getShareCount(): number {
  const v = readSigned(SHARE_COUNT_KEY, "0");

  if (v === "__TAMPERED__") {
    writeSigned(SHARE_COUNT_KEY, "0");
    return 0;
  }

  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

export function increaseShareCount(): number {
  const next = getShareCount() + 1;
  writeSigned(SHARE_COUNT_KEY, String(next));
  return next;
}

export function resetShareCount() {
  writeSigned(SHARE_COUNT_KEY, "0");
}

export function isUnlocked(): boolean {
  return getShareCount() >= REQUIRED_SHARES;
}

/** -------------------- Discount Code -------------------- */

function makeDiscountCode() {
  return `FLY-${randomCode(5)}`;
}

export function getOrCreateDiscountCode(): string {
  if (typeof window === "undefined") return "FLY-XXXXX";

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

/** -------------------- Optional: Discount Amount Logic -------------------- */

export function computeDiscountAmount(shareCount: number): number {
  if (shareCount >= 3) return 3;
  if (shareCount >= 1) return 2;
  return 0;
}

/** -------------------- Cooldown ضد اسپم (اختیاری) -------------------- */

const LAST_SHARE_TS_KEY = "flyalrafah_last_share_ts";
const SHARE_COOLDOWN_MS = 20_000;

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

export function resetShareCooldown() {
  removeSigned(LAST_SHARE_TS_KEY);
}

/** -------------------- Full Reset -------------------- */

export function resetAll() {
  removeSigned(PHONE_KEY);
  removeSigned(STARTED_AT_KEY);

  removeSigned(REF_CODE_KEY);
  removeSigned(SHARE_COUNT_KEY);
  removeSigned(DISCOUNT_KEY);
  removeSigned(LAST_SHARE_TS_KEY);

  // اگر خواستی ریست کامل دستگاه هم بشه:
  // localStorage.removeItem(DEVICE_ID_KEY);
}
