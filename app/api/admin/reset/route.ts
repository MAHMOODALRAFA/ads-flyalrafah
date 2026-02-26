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

    const body = await req.json().catch(() => ({} as any));

    const userId = String(body.userId || "").trim();
    const wipeReferrals = Boolean(body.wipeReferrals);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "missing_userId" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ بررسی وجود کاربر
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ ریست امن
    const updated = await prisma.user.update({
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

    // ✅ پاک‌کردن referrals (اختیاری)
    if (wipeReferrals) {
      await prisma.referral.deleteMany({
        where: { referrerId: userId },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        user: updated,
        wipedReferrals: wipeReferrals,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}