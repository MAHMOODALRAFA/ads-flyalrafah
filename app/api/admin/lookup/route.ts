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

type LastJoinRow = { referredPhone: string; createdAt: Date };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // ✅ ساده‌ترین محافظت: پسورد از env
    const pass = String(body.pass || "");
    const adminPass = process.env.ADMIN_PASS || "";
    if (!adminPass || pass !== adminPass) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

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

    const joins = await prisma.referral.count({ where: { referrerId: user.id } });

    // آخرین 20 شماره‌ای که join شده‌اند
    const lastJoins = await prisma.referral.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { referredPhone: true, createdAt: true },
    });

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
      lastJoins: (lastJoins as LastJoinRow[]).map((j: LastJoinRow) => ({
        referredPhone: j.referredPhone,
        createdAt: j.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
