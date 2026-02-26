// app/api/questions/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { verifySessionToken } from "@/app/lib/session";

function noStore() {
  return { "Cache-Control": "no-store" };
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fa_session")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore() }
      );
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401, headers: noStore() }
      );
    }

    const body = await req.json().catch(() => ({} as any));

    const destination = body.destination ? String(body.destination) : null;
    const q1 = String(body.q1 || "").trim();
    const q2 = String(body.q2 || "").trim();

    if (!q1 || !q2) {
      return NextResponse.json(
        { ok: false, error: "bad_request" },
        { status: 400, headers: noStore() }
      );
    }

    // ✅ Ensure user exists (by session userId)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: noStore() }
      );
    }

    // ✅ Because userId is NOT unique in schema, we can't use upsert(where: { userId })
    const existing = await prisma.questionAnswer.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const answer = existing
      ? await prisma.questionAnswer.update({
          where: { id: existing.id },
          data: {
            destination,
            q1,
            q2,
          },
          select: {
            id: true,
            destination: true,
            q1: true,
            q2: true,
            createdAt: true,
          },
        })
      : await prisma.questionAnswer.create({
          data: {
            userId: user.id,
            destination,
            q1,
            q2,
          },
          select: {
            id: true,
            destination: true,
            q1: true,
            q2: true,
            createdAt: true,
          },
        });

    return NextResponse.json({ ok: true, answer }, { headers: noStore() });
  } catch (err) {
    console.error("QUESTIONS_SAVE_ERROR", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: noStore() }
    );
  }
}