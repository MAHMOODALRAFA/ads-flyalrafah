// app/api/share/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { verifySessionToken } from "@/app/lib/session";

const REQUIRED_SHARES = 5;

// Anti-abuse cooldown (seconds)
const SHARE_COOLDOWN_SEC = 60;

// Points rules
const FIRST_SHARE_POINTS = 5;
const NORMAL_SHARE_POINTS = 1;

function noStore() {
  return { "Cache-Control": "no-store" };
}

function computeCooldown(lastShareAt: Date | null) {
  const now = Date.now();
  const last = lastShareAt ? lastShareAt.getTime() : 0;
  const elapsed = last ? now - last : Number.POSITIVE_INFINITY;

  const remainingMs = Math.max(0, SHARE_COOLDOWN_SEC * 1000 - elapsed);
  const cooldownRemainingSec = Math.ceil(remainingMs / 1000);

  return {
    isBlocked: cooldownRemainingSec > 0,
    cooldownRemainingSec,
    waitMinutes: Math.ceil(cooldownRemainingSec / 60),
    lastShareAt: lastShareAt ? lastShareAt.toISOString() : null,
  };
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fa_session")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore() }
      );
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401, headers: noStore() }
      );
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - SHARE_COOLDOWN_SEC * 1000);

    // 1) FIRST SHARE credit (atomic)
    const firstShareCredit = await prisma.user.updateMany({
      where: {
        id: decoded.userId,
        sharesGiven: 0,
        OR: [{ lastShareAt: null }, { lastShareAt: { lt: cutoff } }],
      },
      data: {
        points: { increment: FIRST_SHARE_POINTS },
        sharesGiven: { increment: 1 },
        lastShareAt: now,
      },
    });

    if (firstShareCredit.count === 1) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          phone: true,
          refCode: true,
          points: true,
          sharesGiven: true,
          lastShareAt: true,
        },
      });

      const cd = computeCooldown(user?.lastShareAt ?? null);

      return NextResponse.json(
        {
          ok: true,
          credited: true,
          creditMode: "first_share",
          addedPoints: FIRST_SHARE_POINTS,
          addedShares: 1,
          user: {
            phone: user?.phone ?? null,
            refCode: user?.refCode ?? null,
            points: user?.points ?? null,
            sharesGiven: user?.sharesGiven ?? null,
            lastShareAt: user?.lastShareAt?.toISOString() ?? null,
          },
          unlocked: (user?.sharesGiven ?? 0) >= REQUIRED_SHARES,
          requiredShares: REQUIRED_SHARES,
          cooldownSec: SHARE_COOLDOWN_SEC,
          ...cd,
        },
        { status: 200, headers: noStore() }
      );
    }

    // 2) NORMAL SHARE credit (atomic) with cooldown
    const normalCredit = await prisma.user.updateMany({
      where: {
        id: decoded.userId,
        OR: [{ lastShareAt: null }, { lastShareAt: { lt: cutoff } }],
      },
      data: {
        points: { increment: NORMAL_SHARE_POINTS },
        sharesGiven: { increment: 1 },
        lastShareAt: now,
      },
    });

    if (normalCredit.count === 1) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          phone: true,
          refCode: true,
          points: true,
          sharesGiven: true,
          lastShareAt: true,
        },
      });

      const cd = computeCooldown(user?.lastShareAt ?? null);

      return NextResponse.json(
        {
          ok: true,
          credited: true,
          creditMode: "normal",
          addedPoints: NORMAL_SHARE_POINTS,
          addedShares: 1,
          user: {
            phone: user?.phone ?? null,
            refCode: user?.refCode ?? null,
            points: user?.points ?? null,
            sharesGiven: user?.sharesGiven ?? null,
            lastShareAt: user?.lastShareAt?.toISOString() ?? null,
          },
          unlocked: (user?.sharesGiven ?? 0) >= REQUIRED_SHARES,
          requiredShares: REQUIRED_SHARES,
          cooldownSec: SHARE_COOLDOWN_SEC,
          ...cd,
        },
        { status: 200, headers: noStore() }
      );
    }

    // 3) Cooldown (or user missing)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        phone: true,
        refCode: true,
        points: true,
        sharesGiven: true,
        lastShareAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: noStore() }
      );
    }

    const cd = computeCooldown(user.lastShareAt);

    return NextResponse.json(
      {
        ok: true,
        credited: false,
        creditMode: "cooldown",
        reason: "cooldown",
        cooldownSec: SHARE_COOLDOWN_SEC,
        ...cd,
        user: {
          phone: user.phone,
          refCode: user.refCode,
          points: user.points,
          sharesGiven: user.sharesGiven,
        },
        unlocked: user.sharesGiven >= REQUIRED_SHARES,
        requiredShares: REQUIRED_SHARES,
      },
      { status: 200, headers: noStore() }
    );
  } catch (e) {
    console.error("SHARE_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: noStore() }
    );
  }
}