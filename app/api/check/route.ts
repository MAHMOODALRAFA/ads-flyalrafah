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
  return x.replace(/\+/g, "");
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

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
      select: {
        id: true,
        phone: true,
        name: true,
        destination: true,
        refCode: true,
        points: true,
        lastShareAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const joins = await prisma.referral.count({
      where: { referrerId: user.id },
    });

    const now = Date.now();
    const last = user.lastShareAt ? new Date(user.lastShareAt).getTime() : 0;
    const cooldownMs = SHARE_COOLDOWN_MIN * 60_000;

    const isBlocked = !!last && now - last < cooldownMs;
    const waitMinutes = isBlocked ? Math.max(1, Math.ceil((cooldownMs - (now - last)) / 60_000)) : 0;

    return NextResponse.json({
      ok: true,
      user: {
        phone: user.phone,
        name: user.name,
        destination: user.destination,
        refCode: user.refCode,
        points: user.points,
        joins,
        lastShareAt: user.lastShareAt ? user.lastShareAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      },
      shareCooldown: {
        isBlocked,
        waitMinutes,
        lastShareAt: user.lastShareAt ? user.lastShareAt.toISOString() : null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
