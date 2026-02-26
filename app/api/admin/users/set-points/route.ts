// app/api/admin/users/set-points/route.ts
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
  const points = Number(body?.points);

  if (!userId || !Number.isFinite(points) || points < 0) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const u = await prisma.user.update({
    where: { id: userId },
    data: { points: Math.floor(points) },
    select: { id: true, points: true },
  });

  return NextResponse.json(
    { ok: true, user: u },
    { headers: { "Cache-Control": "no-store" } }
  );
}