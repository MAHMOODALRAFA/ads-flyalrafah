// app/api/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { makeSessionToken } from "@/app/lib/session";
import { Destination } from "@prisma/client";
import { randomBytes } from "crypto";

const SIGNUP_BONUS_POINTS = 5;
const REFERRAL_REWARD_POINTS = 10;
const DEFAULT_CAMPAIGN = "default";

function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  return String(input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhoneDigits(input: string) {
  return normalizeDigits(input).replace(/[^\d]/g, "");
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

function parseDestination(input: unknown): Destination | null {
  const raw = String(input ?? "").trim().toLowerCase();
  const map: Record<string, Destination> = {
    shiraz: Destination.SHIRAZ,
    tehran: Destination.TEHRAN,
    mashhad: Destination.MASHHAD,
    chabahar: Destination.CHABAHAR,
    kish: Destination.KISH,
    "bandar-abbas": Destination.BANDAR_ABBAS,
    bandar_abbas: Destination.BANDAR_ABBAS,
    bandarabbas: Destination.BANDAR_ABBAS,
    // ✅ FIX: UI sends "ahvaz"
    ahvaz: Destination.AHWAZ,
    // keep legacy just in case
    ahwaz: Destination.AHWAZ,
  };
  return map[raw] ?? null;
}

function makeRefCodeBase(phoneDigits: string) {
  const tail = phoneDigits.slice(-6).padStart(6, "0");
  return `FA${tail}`;
}

function shortRand(n = 3) {
  // ✅ stronger than Math.random
  const s = randomBytes(8).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.slice(0, n).padEnd(n, "X");
}

function setSessionCookie(res: NextResponse, userId: string) {
  const token = makeSessionToken(userId);
  res.cookies.set("fa_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const phoneDigits = cleanPhoneDigits(body.phone);
    const destination = parseDestination(body.destination);
    const name = body.name ? String(body.name) : null;

    if (!phoneDigits || !isValidPhoneDigits(phoneDigits) || !destination) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    // ✅ Fast path: existing user
    const existing = await prisma.user.findUnique({
      where: { phone: phoneDigits },
      select: { id: true, phone: true, refCode: true, points: true },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { phone: phoneDigits },
        data: {
          ...(name ? { name } : {}),
          destination,
        },
        select: { id: true, phone: true, refCode: true, points: true },
      });

      const res = NextResponse.json(
        {
          ok: true,
          user: updated,
          alreadyRegistered: true,
          bonusApplied: false,
          bonusPoints: 0,
          referralClaimed: false,
          referralRewardPoints: 0,
        },
        { status: 200, headers: noStoreHeaders() }
      );

      setSessionCookie(res, updated.id);
      return res;
    }

    const base = makeRefCodeBase(phoneDigits);

    // ✅ Create user + claim referral in ONE transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1) create user with signup bonus (unique refCode generation)
      let created:
        | { id: string; phone: string; refCode: string; points: number }
        | undefined;

      for (let attempt = 0; attempt < 6; attempt++) {
        const refCode = attempt === 0 ? base : `${base}${shortRand(3)}`;
        try {
          created = await tx.user.create({
            data: {
              phone: phoneDigits,
              name,
              destination,
              refCode,
              points: SIGNUP_BONUS_POINTS,
            },
            select: { id: true, phone: true, refCode: true, points: true },
          });
          break;
        } catch (e: any) {
          // Prisma unique constraint
          if (e?.code === "P2002") {
            const target = String(e?.meta?.target ?? "");
            // ✅ race condition: phone already created in parallel request
            if (target.includes("phone")) {
              const already = await tx.user.findUnique({
                where: { phone: phoneDigits },
                select: { id: true, phone: true, refCode: true, points: true },
              });
              if (already) {
                return { created: already, referralClaimed: false, alreadyRegistered: true };
              }
            }
            // refCode collision => retry
            continue;
          }
          throw e;
        }
      }

      if (!created) {
        throw new Error("REFCODE_GENERATION_FAILED");
      }

      // If it was race existing, stop referral claim here (already handled above)
      // (we return early when phone collision happens)
      // Otherwise continue with referral claim
      // 2) find referral lead for this phone
      const lead =
        (await tx.referral.findFirst({
          where: {
            referredPhone: phoneDigits,
            referredUserId: null,
            campaign: DEFAULT_CAMPAIGN,
          },
          select: { id: true, referrerId: true },
          orderBy: { createdAt: "asc" },
        })) ??
        (await tx.referral.findFirst({
          where: {
            referredPhone: phoneDigits,
            referredUserId: null,
            campaign: null,
          },
          select: { id: true, referrerId: true },
          orderBy: { createdAt: "asc" },
        }));

      let referralClaimed = false;

      if (lead) {
        // 3) claim atomically (only if still unclaimed)
        const claim = await tx.referral.updateMany({
          where: { id: lead.id, referredUserId: null },
          data: { referredUserId: created.id },
        });

        if (claim.count === 1) {
          referralClaimed = true;

          // 4) reward referrer (+10)
          await tx.user.update({
            where: { id: lead.referrerId },
            data: { points: { increment: REFERRAL_REWARD_POINTS } },
            select: { id: true },
          });
        }
      }

      return { created, referralClaimed, alreadyRegistered: false };
    });

    // if race returned alreadyRegistered
    if ((result as any).alreadyRegistered === true) {
      const res = NextResponse.json(
        {
          ok: true,
          user: result.created,
          alreadyRegistered: true,
          bonusApplied: false,
          bonusPoints: 0,
          referralClaimed: false,
          referralRewardPoints: 0,
        },
        { status: 200, headers: noStoreHeaders() }
      );
      setSessionCookie(res, result.created.id);
      return res;
    }

    const res = NextResponse.json(
      {
        ok: true,
        user: result.created,
        alreadyRegistered: false,
        bonusApplied: true,
        bonusPoints: SIGNUP_BONUS_POINTS,
        referralClaimed: result.referralClaimed,
        referralRewardPoints: result.referralClaimed ? REFERRAL_REWARD_POINTS : 0,
      },
      { status: 200, headers: noStoreHeaders() }
    );

    setSessionCookie(res, result.created.id);
    return res;
  } catch (err: any) {
    console.error("REGISTER_ERROR", err);

    const error =
      err?.message === "REFCODE_GENERATION_FAILED"
        ? "refcode_failed"
        : "server_error";

    return NextResponse.json(
      { ok: false, error },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}