import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(
  _req: Request,
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

    const user = await prisma.user.findUnique({
      where: { id: cleanId },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, ...noStore }
      );
    }

    return NextResponse.json({ ok: true, user }, noStore);
  } catch (err) {
    console.error("ADMIN_USER_ERROR", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, ...noStore }
    );
  }
}

export async function DELETE(
  _req: Request,
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

    await prisma.user.delete({
      where: { id: cleanId },
    });

    return NextResponse.json({ ok: true }, noStore);
  } catch (err) {
    console.error("ADMIN_USER_DELETE_ERROR", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, ...noStore }
    );
  }
}