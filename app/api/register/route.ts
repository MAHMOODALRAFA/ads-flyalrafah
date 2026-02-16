import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizePhone(input: string) {
  return input.replace(/\s+/g, "").replace(/^00/, "+");
}

function makeRefCode(phone: string) {
  // ref کوتاه و ساده (قابل تغییر)
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-6).padStart(6, "0");
  return `FA${tail}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const phoneRaw = String(body.phone ?? "");
    const destination = String(body.destination ?? "");
    const name = body.name ? String(body.name) : null;

    if (!phoneRaw || !destination) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: phone, destination" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(phoneRaw);

    const existing = await prisma.user.findUnique({ where: { phone } });

    if (existing) {
      // اگر قبلاً ثبت شده، فقط اطلاعات را آپدیت می‌کنیم
      const updated = await prisma.user.update({
        where: { phone },
        data: {
          name: name ?? existing.name,
          destination: destination ?? existing.destination,
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: updated.id,
          phone: updated.phone,
          refCode: updated.refCode,
          points: updated.points,
        },
        alreadyRegistered: true,
      });
    }

    const refCode = makeRefCode(phone);

    const created = await prisma.user.create({
      data: {
        phone,
        name,
        destination,
        refCode,
        points: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: created.id,
        phone: created.phone,
        refCode: created.refCode,
        points: created.points,
      },
      alreadyRegistered: false,
    });
  } catch (err: any) {
    console.error("REGISTER_ERROR", err);
    return NextResponse.json(
      { ok: false, message: "Registration failed. Try again." },
      { status: 500 }
    );
  }
}
