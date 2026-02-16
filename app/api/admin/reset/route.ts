import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const pass = String(body.pass || "");
    const adminPass = process.env.ADMIN_PASS || "";
    if (!adminPass || pass !== adminPass) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const phone = String(body.phone || "").trim();
    if (!phone) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { phone },
      data: {
        points: 0,
        lastShareAt: null,
      },
      select: { phone: true, refCode: true, points: true, lastShareAt: true },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
