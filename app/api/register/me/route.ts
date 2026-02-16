import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = String(searchParams.get("phone") || "").trim();

    if (!phone) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { phone: true, refCode: true, points: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
