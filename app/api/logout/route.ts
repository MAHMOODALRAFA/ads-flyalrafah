// app/api/logout/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200, headers: noStoreHeaders() });

  // ✅ Delete the session cookie (must match path)
  res.cookies.set("fa_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

// (Optional) allow GET for quick manual testing in browser
export async function GET() {
  return POST();
}