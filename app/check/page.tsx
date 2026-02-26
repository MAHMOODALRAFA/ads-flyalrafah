// app/api/check/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { verifySessionToken } from "@/app/lib/session";

const SHARE_COOLDOWN_SEC = 60;

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
        phone: true,
        name: true,
        destination: true,
        refCode: true,
        points: true,
        sharesGiven: true,
        lastShareAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ count only real joins (claimed)
    const joins = await prisma.referral.count({
      where: { referrerId: decoded.userId, referredUserId: { not: null } },
    });

    const now = Date.now();
    const last = user.lastShareAt ? user.lastShareAt.getTime() : 0;
    const elapsed = last ? now - last : Infinity;

    const remainingMs = Math.max(0, SHARE_COOLDOWN_SEC * 1000 - elapsed);
    const cooldownRemainingSec = Math.ceil(remainingMs / 1000);

    const isBlocked = cooldownRemainingSec > 0;
    const waitMinutes = Math.max(1, Math.ceil(cooldownRemainingSec / 60));

    return NextResponse.json(
      {
        ok: true,
        user: {
          phone: user.phone,
          name: user.name,
          destination: user.destination,
          refCode: user.refCode,
          points: Number(user.points || 0),
          joins,
          sharesGiven: Number(user.sharesGiven || 0),
          lastShareAt: user.lastShareAt ? user.lastShareAt.toISOString() : null,
          createdAt: user.createdAt.toISOString(),
        },
        shareCooldown: {
          isBlocked,
          cooldownRemainingSec,
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