import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const u = (process.env.ADMIN_USER || "").trim();
    const p = (process.env.ADMIN_PASS || "").trim();

    // اگر env ها ست نشده باشند
    if (!u || !p) {
      return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
    }

    if (String(username).trim() !== u || String(password).trim() !== p) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
