// app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const password = String(body?.password ?? "");

    const expected = process.env.ADMIN_PASSWORD ?? "";
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "missing admin password" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (password !== expected) {
      return NextResponse.json(
        { ok: false, error: "invalid password" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ ست کردن کوکی ادمین (با نسخه جدید adminAuth.ts)
    setAdminCookie();

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad request" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}