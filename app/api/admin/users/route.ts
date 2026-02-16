// app/api/admin/users/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // فعلاً ساده: بعداً دیتابیس + admin guard اضافه می‌کنیم
  return NextResponse.json({ ok: true, users: [] });
}

