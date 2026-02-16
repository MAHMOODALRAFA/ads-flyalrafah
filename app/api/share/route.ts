import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return String(input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhoneDigits(input: string) {
  const x = normalizeDigits(input).replace(/[^\d+]/g, "");
  return x.replace(/\+/g, "");
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const phoneDigits = cleanPhoneDigits(body?.phone);

    if (!phoneDigits) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }
    if (!isValidPhoneDigits(phoneDigits)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone: phoneDigits },
      select: { phone: true, points: true, refCode: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // ✅ +1 point
    const updated = await prisma.user.update({
      where: { phone: phoneDigits },
      data: { points: { increment: 1 } },
      select: { phone: true, points: true, refCode: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
