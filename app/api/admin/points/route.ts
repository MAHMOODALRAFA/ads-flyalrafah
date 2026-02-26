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

    const body = await req.json().catch(() => ({} as any));
    const userId = String(body.userId || "").trim();
    const amountRaw = Number(body.amount);

    const amount = Number.isFinite(amountRaw) ? Math.trunc(amountRaw) : NaN;

    if (!userId || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ محدودیت منطقی برای جلوگیری از اشتباه انسانی
    if (Math.abs(amount) > 10000) {
      return NextResponse.json(
        { ok: false, error: "amount_too_large" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ جلوگیری از منفی شدن امتیاز (اختیاری ولی پیشنهادی)
    // اگر می‌خوای اجازه بدی منفی بشه، این بخش رو بردار.
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!current) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (amount < 0 && current.points + amount < 0) {
      return NextResponse.json(
        { ok: false, error: "points_cannot_be_negative" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
      select: { id: true, phone: true, points: true },
    });

    return NextResponse.json(
      { ok: true, user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}