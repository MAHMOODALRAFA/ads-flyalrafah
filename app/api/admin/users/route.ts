// app/api/admin/users/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const isAdmin = await isAdminAuthenticatedServer();

  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(req.url);

  const q = (url.searchParams.get("q") || "").trim();

  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 20);

  const where =
    q.length >= 2
      ? {
          OR: [
            { phone: { contains: q } },
            { refCode: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

  // ✅ total count (برای pagination)
  const total = await prisma.user.count({ where });

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,

    select: {
      id: true,
      phone: true,
      name: true,
      destination: true,
      refCode: true,
      points: true,
      lastShareAt: true,
      createdAt: true,
      updatedAt: true,

      // ✅ COUNT referrals (خیلی مهم)
      _count: {
        select: {
          referralsGiven: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      users,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}