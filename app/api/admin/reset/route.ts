// app/api/admin/reset/route.ts
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

    const body = await req
      .json()
      .catch(() => ({} as { userId?: unknown; wipeReferrals?: unknown }));

    const userId = String(body?.userId ?? "").trim();
    const wipeReferrals = Boolean(body?.wipeReferrals);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "missing_userId" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!existing) return { kind: "not_found" as const };

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          points: 0,
          lastShareAt: null,
        },
        select: {
          id: true,
          phone: true,
          points: true,
          lastShareAt: true,
          refCode: true,
        },
      });

      let deleted = 0;
      if (wipeReferrals) {
        const r = await tx.referral.deleteMany({
          where: { referrerId: userId },
        });
        deleted = r.count;
      }

      return {
        kind: "ok" as const,
        user: updated,
        wipedReferrals: wipeReferrals,
        deletedReferrals: deleted,
      };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: result.user,
        wipedReferrals: result.wipedReferrals,
        deletedReferrals: result.deletedReferrals,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}