export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

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

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function generateUniqueRefCode() {
  for (let i = 0; i < 6; i++) {
    const code = randomCode(6);
    const exists = await prisma.user.findUnique({ where: { refCode: code } });
    if (!exists) return code;
  }
  // fallback خیلی نادر
  return `${randomCode(4)}${Date.now().toString().slice(-2)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const phoneDigits = cleanPhone(body.phone);
    const name = String(body.name || "").trim();
    const destination = String(body.destination || "").trim();

    if (!phoneDigits) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }
    if (!isValidPhoneDigits(phoneDigits)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    // اگر کاربر قبلاً هست -> اطلاعات رو آپدیت کن و برگردون
    const existing = await prisma.user.findUnique({ where: { phone: phoneDigits } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { phone: phoneDigits },
        data: {
          name: name || existing.name,
          destination: destination || existing.destination,
        },
        select: { phone: true, name: true, destination: true, refCode: true, points: true },
      });

      return NextResponse.json({ ok: true, user: updated, created: false });
    }

    const refCode = await generateUniqueRefCode();

    const created = await prisma.user.create({
      data: {
        phone: phoneDigits,
        name: name || null,
        destination: destination || null,
        refCode,
        points: 0,
      },
      select: { phone: true, name: true, destination: true, refCode: true, points: true },
    });

    return NextResponse.json({ ok: true, user: created, created: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
