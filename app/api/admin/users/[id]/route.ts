// app/api/admin/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isAdminAuthenticatedServer();

    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, ...noStore }
      );
    }

    const { id } = await context.params;
    const cleanId = String(id ?? "").trim();

    if (!cleanId) {
      return NextResponse.json(
        { ok: false, error: "missing_id" },
        { status: 400, ...noStore }
      );
    }

    // ✅ بررسی وجود کاربر
    const existing = await prisma.user.findUnique({
      where: { id: cleanId },
      select: { id: true, phone: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, ...noStore }
      );
    }

    // ✅ Transactional delete
    await prisma.$transaction([
      prisma.referral.deleteMany({
        where: { referrerId: cleanId },
      }),

      prisma.user.delete({
        where: { id: cleanId },
      }),
    ]);

    return NextResponse.json(
      { ok: true, deletedUser: existing.phone },
      noStore
    );
  } catch (err) {
    console.error("ADMIN_USER_DELETE_ERROR", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, ...noStore }
    );
  }
}