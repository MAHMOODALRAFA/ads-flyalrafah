import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";

function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhoneDigits(input: string) {
  const x = normalizeDigits(String(input || "")).replace(/[^\d+]/g, "");
  return x.replace(/\+/g, ""); // digits only
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const refCode = String(body.refCode || "").trim();
    const referredPhone = cleanPhoneDigits(body.referredPhone);

    if (!refCode) {
      return NextResponse.json({ ok: false, error: "missing_ref_code" }, { status: 400 });
    }
    if (!referredPhone || !isValidPhoneDigits(referredPhone)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    const referrer = await prisma.user.findUnique({
      where: { refCode },
      select: { id: true, phone: true, refCode: true, points: true },
    });

    if (!referrer) {
      return NextResponse.json({ ok: false, error: "invalid_ref_code" }, { status: 404 });
    }

    if (referrer.phone === referredPhone) {
      return NextResponse.json({ ok: false, error: "self_join_not_allowed" }, { status: 400 });
    }

    const existing = await prisma.referral.findUnique({
      where: { referredPhone },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { ok: true, credited: false, reason: "already_joined" },
        { status: 200 }
      );
    }

    const addedPoints = 10;

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredPhone,
        },
      });

      return tx.user.update({
        where: { id: referrer.id },
        data: { points: { increment: addedPoints } },
        select: { phone: true, refCode: true, points: true },
      });
    });

    return NextResponse.json({
      ok: true,
      credited: true,
      addedPoints,
      user: updated,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
