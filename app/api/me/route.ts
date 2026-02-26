// app/api/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { verifySessionToken } from "@/app/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fa_session")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      // ✅ clear broken cookie
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });

      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        phone: true,
        name: true,
        destination: true,
        refCode: true,
        points: true,
      },
    });

    if (!user) {
      cookieStore.set("fa_session", "", { path: "/", maxAge: 0 });

      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, user },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("ME_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}