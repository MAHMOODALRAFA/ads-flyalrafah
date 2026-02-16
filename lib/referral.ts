// app/lib/referral.ts

const REF_CODE_KEY = "flyalrafah_ref_code";
const SHARE_COUNT_KEY = "flyalrafah_share_count";

// ✅ signature keys (anti-tamper)
const SIG_KEY = "flyalrafah_sig_v1";

// ⚠️ این فقط برای سخت‌تر کردن تقلب است (امنیت واقعی با سرور میاد)
const SALT = "flyalrafah_local_sig_v1_salt";

export function generateCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

// --- SHA256 helpers (Web Crypto) ---
async function sha256(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeSignature(refCode: string, shareCount: number) {
  return sha256(`${refCode}|${shareCount}|${SALT}`);
}

async function signState(refCode: string, shareCount: number) {
  const sig = await makeSignature(refCode, shareCount);
  localStorage.setItem(SIG_KEY, sig);
}

async function verifyState(refCode: string, shareCount: number) {
  const sig = localStorage.getItem(SIG_KEY);
  if (!sig) return false;
  const expected = await makeSignature(refCode, shareCount);
  return sig === expected;
}

// ✅ استفاده در صفحات: وقتی صفحه لود شد، اینو صدا بزن
// اگر دستکاری شده بود، shareCount رو صفر می‌کنه و دوباره امضا می‌زنه
export async function verifyReferralOrReset(): Promise<{
  tampered: boolean;
  refCode: string;
  shareCount: number;
}> {
  if (typeof window === "undefined") {
    return { tampered: false, refCode: "", shareCount: 0 };
  }

  const refCode = getRefCode(); // مطمئن میشه refCode وجود داره
  const shareCount = getShareCount();

  const ok = await verifyState(refCode, shareCount);
  if (ok) return { tampered: false, refCode, shareCount };

  // اگر sig نبود یا غلط بود → احتمال دستکاری
  localStorage.setItem(SHARE_COUNT_KEY, "0");
  await signState(refCode, 0);

  return { tampered: true, refCode, shareCount: 0 };
}

export function getRefCode(): string {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem(REF_CODE_KEY);
  if (saved) return saved;

  const code = generateCode();
  localStorage.setItem(REF_CODE_KEY, code);

  // اولین امضا (با shareCount فعلی)
  const sc = safeNumber(localStorage.getItem(SHARE_COUNT_KEY), 0);
  void signState(code, sc);

  return code;
}

export function getShareCount(): number {
  if (typeof window === "undefined") return 0;
  return safeNumber(localStorage.getItem(SHARE_COUNT_KEY), 0);
}

// ✅ اگر خواستی مستقیم set کنی
export function setShareCount(count: number): number {
  if (typeof window === "undefined") return 0;
  const refCode = getRefCode();
  const next = Math.max(0, Math.floor(count));
  localStorage.setItem(SHARE_COUNT_KEY, String(next));
  void signState(refCode, next);
  return next;
}

export function increaseShareCount(): number {
  if (typeof window === "undefined") return 0;

  const refCode = getRefCode();
  const next = getShareCount() + 1;

  localStorage.setItem(SHARE_COUNT_KEY, String(next));

  // امضا رو هم آپدیت کن (بدون await)
  void signState(refCode, next);

  return next;
}

export function resetReferral() {
  if (typeof window === "undefined") return;

  const refCode = getRefCode();
  localStorage.setItem(SHARE_COUNT_KEY, "0");
  void signState(refCode, 0);
}

export function makeCoupon(code: string) {
  const safe = (code || "XXXX").toUpperCase().slice(0, 6);
  return `FLY-${safe}`;
}

export function getDeviceId(): string {
  // اگر قبلاً داخل فایل‌ات getOrCreateDeviceId داری همان را صدا بزن
  // (در نسخه‌ای که برات نوشتم، getOrCreateDeviceId داخلی بود)
  // پس همین تابع را داخل همان فایل، زیر util ها قرار بده و این را export کن.

  if (typeof window === "undefined") return "server";
  const key = "flyalrafah_device_id";
  const saved = localStorage.getItem(key);
  if (saved) return saved;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = (len = 10) => {
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const id = `dev_${rnd(10)}_${Date.now().toString(36)}`;
  localStorage.setItem(key, id);
  return id;
}
