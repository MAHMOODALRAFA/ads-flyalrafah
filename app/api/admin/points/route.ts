import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  const { userId, amount } = await req.json();

  if (!userId || !amount) {
    return NextResponse.json({ ok: false });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: Number(amount) },
    },
  });

  return NextResponse.json({ ok: true, points: user.points });
}
