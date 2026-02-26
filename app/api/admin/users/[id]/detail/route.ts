import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  try {
    const isAdmin = await isAdminAuthenticatedServer();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, ...noStore }
      );
    }

    const id = String(context.params.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "missing_id" },
        { status: 400, ...noStore }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        referralsGiven: true,
        answer: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, ...noStore }
      );
    }

    return NextResponse.json({ ok: true, user }, noStore);
  } catch (err) {
    console.error("ADMIN_USER_DETAIL_ERROR", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, ...noStore }
    );
  }
}