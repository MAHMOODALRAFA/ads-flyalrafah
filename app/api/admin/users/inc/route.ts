// app/api/admin/users/inc/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const isAdmin = await isAdminAuthenticatedServer();

  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({} as any));

  const userId = String(body?.userId || "");
  const delta = Number(body?.delta ?? 1);

  if (!userId || !Number.isFinite(delta)) {
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 }
    );
  }

  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      points: {
        increment: Math.floor(delta),
      },
    },
    select: { id: true, points: true },
  });

  return NextResponse.json({ ok: true, user: u });
}