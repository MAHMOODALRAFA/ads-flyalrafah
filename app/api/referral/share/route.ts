import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

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

// ✅ تنظیم کول‌داون (دقیقه)
const SHARE_COOLDOWN_MIN = 1;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const phone = cleanPhoneDigits(body.phone);
    if (!phone || !isValidPhoneDigits(phone)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, refCode: true, points: true, lastShareAt: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    // ✅ cooldown check
    const now = Date.now();
    const last = user.lastShareAt ? new Date(user.lastShareAt).getTime() : 0;
    const cooldownMs = SHARE_COOLDOWN_MIN * 60_000;

    if (last && now - last < cooldownMs) {
      const remainingMs = cooldownMs - (now - last);
      const waitMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));

      return NextResponse.json({
        ok: true,
        credited: false,
        reason: "cooldown",
        waitMinutes,
        user: { phone: user.phone, refCode: user.refCode, points: user.points, lastShareAt: user.lastShareAt?.toISOString?.() ?? null },
      });
    }

    const addedPoints = 1;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        points: { increment: addedPoints },
        lastShareAt: new Date(),
      },
      select: { phone: true, refCode: true, points: true, lastShareAt: true },
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
