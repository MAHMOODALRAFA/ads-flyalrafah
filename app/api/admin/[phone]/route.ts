import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cleanPhoneDigits, isAdminAuthed } from "../_lib";

function toSafeInt(x: any, fallback = 0) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function isValidPhoneDigits(d: string) {
  return d.length >= 8 && d.length <= 15;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ phone: string }> }
) {
  // ✅ admin auth (async)
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { phone: phoneParam } = await ctx.params;
  const phone = cleanPhoneDigits(phoneParam);

  if (!phone || !isValidPhoneDigits(phone)) {
    return NextResponse.json(
      { ok: false, error: "invalid_phone" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const action = String(body?.action || "");

  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { phone: true, points: true, lastShareAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // actions:
    // - "delta_points": { delta: number }
    // - "set_points": { points: number }
    // - "reset_user": resets points + lastShareAt

    if (action === "delta_points") {
      const delta = toSafeInt(body?.delta, 0);
      const next = Math.max(0, user.points + delta);

      const updated = await prisma.user.update({
        where: { phone },
        data: { points: next },
        select: { phone: true, points: true },
      });

      return NextResponse.json(
        { ok: true, user: updated },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (action === "set_points") {
      const points = Math.max(0, toSafeInt(body?.points, 0));

      const updated = await prisma.user.update({
        where: { phone },
        data: { points },
        select: { phone: true, points: true },
      });

      return NextResponse.json(
        { ok: true, user: updated },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (action === "reset_user") {
      const updated = await prisma.user.update({
        where: { phone },
        data: { points: 0, lastShareAt: null },
        select: { phone: true, points: true, lastShareAt: true },
      });

      return NextResponse.json(
        { ok: true, user: updated },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: false, error: "bad_action" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("ADMIN_USER_PATCH_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}