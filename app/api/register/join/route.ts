import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// دقیقا همون منطق register برای یکدست بودن دیتابیس
function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhone(input: string) {
  const x = normalizeDigits(String(input || "")).replace(/[^\d+]/g, "");
  const digits = x.replace(/\+/g, "");
  return digits;
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const refCode = String(body.refCode || "").trim();
    const referredPhoneDigits = cleanPhone(body.referredPhone);

    if (!refCode) {
      return NextResponse.json({ ok: false, error: "missing_refCode" }, { status: 400 });
    }
    if (!referredPhoneDigits) {
      return NextResponse.json({ ok: false, error: "missing_referredPhone" }, { status: 400 });
    }
    if (!isValidPhoneDigits(referredPhoneDigits)) {
      return NextResponse.json({ ok: false, error: "invalid_referredPhone" }, { status: 400 });
    }

    // referrer را با refCode پیدا کن
    const referrer = await prisma.user.findUnique({
      where: { refCode },
      select: { id: true },
    });

    if (!referrer) {
      return NextResponse.json({ ok: false, error: "invalid_refCode" }, { status: 404 });
    }

    // اگر این شماره قبلا join شده، دوباره امتیاز نده
    const exists = await prisma.referral.findUnique({
      where: { referredPhone: referredPhoneDigits },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json({ ok: true, credited: false, reason: "already_joined" });
    }

    // create referral + increment points
    await prisma.$transaction([
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredPhone: referredPhoneDigits,
        },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { points: { increment: 10 } },
      }),
    ]);

    return NextResponse.json({ ok: true, credited: true, addedPoints: 10 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
