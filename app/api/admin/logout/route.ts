// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminCookie();

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}