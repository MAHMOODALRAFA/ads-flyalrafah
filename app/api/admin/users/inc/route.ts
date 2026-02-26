// app/api/admin/users/inc/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminAuthedServer()) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const userId = String(body?.userId || "");
  const delta = Number(body?.delta);

  if (!userId || !Number.isFinite(delta) || Math.abs(delta) > 100000) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // prevent negative
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const next = Math.max(0, user.points + Math.floor(delta));

  const u = await prisma.user.update({
    where: { id: userId },
    data: { points: next },
    select: { id: true, points: true },
  });

  return NextResponse.json(
    { ok: true, user: u },
    { headers: { "Cache-Control": "no-store" } }
  );
}