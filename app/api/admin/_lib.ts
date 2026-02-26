// app/api/admin/_lib.ts
import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "fa_admin";

export function adminTokenFromPassword(pw: string) {
  return createHash("sha256").update(`flyalrafah-admin:${pw}`).digest("hex");
}

// ✅ Next 15/16: cookies() is async
export async function isAdminAuthed(): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) return false;

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;

  return token === adminTokenFromPassword(pw);
}

// Works with NextResponse in route handlers
export function setAdminCookie(res: any) {
  const pw = process.env.ADMIN_PASSWORD || "";
  const token = adminTokenFromPassword(pw);

  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}

export function clearAdminCookie(res: any) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}

export function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return String(input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

export function cleanPhoneDigits(input: string) {
  const x = normalizeDigits(String(input || "")).replace(/[^\d+]/g, "");
  return x.replace(/\+/g, "");
}