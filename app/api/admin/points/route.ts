// app/api/admin/points/route.ts
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
    const amount = Number(body.amount);

    if (!userId || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    // محدودیت ساده (اختیاری) برای جلوگیری از اشتباه
    if (Math.abs(amount) > 100000) {
      return NextResponse.json({ ok: false, error: "amount_too_large" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: Math.trunc(amount) } },
      select: { id: true, phone: true, points: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}