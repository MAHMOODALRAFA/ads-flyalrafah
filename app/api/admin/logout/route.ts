// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  clearAdminCookie();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}