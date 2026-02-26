// app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as { password?: unknown }));
    const password = String(body?.password ?? "").trim();

    const expected = (process.env.ADMIN_PASSWORD ?? "").trim();
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "missing admin password" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json(
        { ok: false, error: "invalid password" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ لازم است await شود
    await setAdminCookie();

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