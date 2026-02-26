// app/api/check/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { verifySessionToken } from "@/app/lib/session";

const SHARE_COOLDOWN_MIN = 30;

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fa_session")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phone: true,
        name: true,
        destination: true,
        refCode: true,
        points: true,
        sharesGiven: true, // ✅ NEW
        lastShareAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ joins = successful joins (claimed only)
    const joins = await prisma.referral.count({
      where: {
        referrerId: user.id,
        referredUserId: { not: null },
      },
    });

    const now = Date.now();
    const last = user.lastShareAt ? user.lastShareAt.getTime() : 0;
    const cooldownMs = SHARE_COOLDOWN_MIN * 60_000;

    const isBlocked = !!last && now - last < cooldownMs;
    const waitMinutes = isBlocked
      ? Math.max(1, Math.ceil((cooldownMs - (now - last)) / 60_000))
      : 0;

    return NextResponse.json(
      {
        ok: true,
        user: {
          phone: user.phone,
          name: user.name,
          destination: user.destination ?? null,
          refCode: user.refCode,
          points: user.points,
          joins,
          sharesGiven: user.sharesGiven, // ✅ NEW
          lastShareAt: user.lastShareAt ? user.lastShareAt.toISOString() : null,
          createdAt: user.createdAt.toISOString(),
        },
        shareCooldown: {
          isBlocked,
          waitMinutes,
          lastShareAt: user.lastShareAt ? user.lastShareAt.toISOString() : null,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("CHECK_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}