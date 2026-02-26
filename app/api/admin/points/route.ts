// app/api/admin/points/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const isAdmin = await isAdminAuthenticatedServer();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({} as { userId?: unknown; amount?: unknown }));
    const userId = String(body?.userId ?? "").trim();
    const amountRaw = Number(body?.amount);
    const amount = Number.isFinite(amountRaw) ? Math.trunc(amountRaw) : NaN;

    if (!userId || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (Math.abs(amount) > 10000) {
      return NextResponse.json(
        { ok: false, error: "amount_too_large" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { points: true },
      });

      if (!current) {
        return { kind: "not_found" as const };
      }

      if (amount < 0 && current.points + amount < 0) {
        return { kind: "negative" as const, points: current.points };
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: amount } },
        select: { id: true, phone: true, points: true },
      });

      return { kind: "ok" as const, user };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (result.kind === "negative") {
      return NextResponse.json(
        { ok: false, error: "points_cannot_be_negative" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, user: result.user },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}