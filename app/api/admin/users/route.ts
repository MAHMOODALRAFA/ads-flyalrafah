// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function isAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const pass = (process.env.ADMIN_PASS || "").trim();
  if (!pass) return false; // env باید ست شده باشد
  return token === pass;
}

export async function GET(req: Request) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        phone: true,
        points: true,
        refCode: true,
        createdAt: true,
        lastShareAt: true,
        _count: { select: { referralsGiven: true } }, // joins
      },
    });

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        points: u.points,
        joins: u._count.referralsGiven,
        refCode: u.refCode,
        createdAt: u.createdAt.toISOString(),
        lastShareAt: u.lastShareAt ? u.lastShareAt.toISOString() : null,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}