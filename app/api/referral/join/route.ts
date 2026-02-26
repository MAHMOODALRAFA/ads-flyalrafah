import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function normalizeDigits(input: unknown) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return String(input ?? "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhoneDigits(input: unknown) {
  const x = normalizeDigits(input).replace(/[^\d+]/g, "");
  return x.replace(/\+/g, ""); // digits only
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

const DEFAULT_CAMPAIGN = "default";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const refCode = String(body.refCode || "").trim();
    const referredPhone = cleanPhoneDigits(body.referredPhone);
    const campaign = String(body.campaign || DEFAULT_CAMPAIGN).trim() || DEFAULT_CAMPAIGN;

    if (!refCode) {
      return NextResponse.json(
        { ok: false, error: "missing_ref_code" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!referredPhone || !isValidPhoneDigits(referredPhone)) {
      return NextResponse.json(
        { ok: false, error: "invalid_phone" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const referrer = await prisma.user.findUnique({
      where: { refCode },
      select: { id: true, phone: true },
    });

    if (!referrer) {
      return NextResponse.json(
        { ok: false, error: "invalid_ref_code" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ self-join check (digits-only on both)
    const referrerDigits = cleanPhoneDigits(referrer.phone);
    if (referrerDigits === referredPhone) {
      return NextResponse.json(
        { ok: false, error: "self_join_not_allowed" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Create referral lead (anti-cheat via @@unique([referredPhone, campaign]))
    try {
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredPhone,
          campaign,
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json(
          { ok: true, tracked: true, credited: false, reason: "already_joined", campaign },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
      throw e;
    }

    return NextResponse.json(
      { ok: true, tracked: true, credited: false, campaign },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("REFERRAL_JOIN_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}