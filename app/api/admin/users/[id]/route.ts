// app/api/admin/users/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    if (!isAdminAuthedServer()) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const id = String(ctx.params.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "missing_id" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ بررسی وجود کاربر
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, phone: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Transactional delete
    await prisma.$transaction([
      prisma.referral.deleteMany({
        where: { referrerId: id },
      }),

      prisma.user.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        deletedUser: existing.phone,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}