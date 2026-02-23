// app/api/admin/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function isAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const pass = (process.env.ADMIN_PASS || "").trim();
  if (!pass) return false;
  return token === pass;
}

export async function POST(req: Request) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const userId = String(body.userId || "");
    const wipeReferrals = Boolean(body.wipeReferrals); // اختیاری

    if (!userId) {
      return NextResponse.json({ ok: false, error: "missing_userId" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { points: 0, lastShareAt: null },
      select: { id: true, phone: true, points: true, lastShareAt: true, refCode: true },
    });

    if (wipeReferrals) {
      await prisma.referral.deleteMany({ where: { referrerId: userId } });
    }

    return NextResponse.json({ ok: true, user: updated, wipedReferrals: wipeReferrals });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}