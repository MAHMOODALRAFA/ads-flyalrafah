import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { Destination } from "@prisma/client";

function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
  };
  return String(input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhoneDigits(input: string) {
  const x = normalizeDigits(String(input || "")).replace(/[^\d+]/g, "");
  return x.replace(/\+/g, "");
}

function isValidPhoneDigits(digits: string) {
  return digits.length >= 8 && digits.length <= 15;
}

function makeRefCodeBase(phoneDigits: string) {
  const tail = phoneDigits.slice(-6).padStart(6, "0");
  return `FA${tail}`;
}

function shortRand(n = 3) {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase();
}

function normalizeDestination(input: any): Destination | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const s = raw
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/[^\w\u0600-\u06FF]/g, "");

  // direct enum strings
  if ((Destination as any)[s]) return (Destination as any)[s];

  // common lowercase values from UI
  const lower = raw.trim().toLowerCase();
  const mapLower: Record<string, Destination> = {
    shiraz: Destination.SHIRAZ,
    tehran: Destination.TEHRAN,
    chabahar: Destination.CHABAHAR,
    kish: Destination.KISH,
    "bandar-abbas": Destination.BANDAR_ABBAS,
    bandar_abbas: Destination.BANDAR_ABBAS,
    bandarabbas: Destination.BANDAR_ABBAS,
    ahwaz: Destination.AHWAZ,
    mashhad: Destination.MASHHAD,
  };
  if (mapLower[lower]) return mapLower[lower];

  // Arabic/Persian labels
  const mapAr: Record<string, Destination> = {
    "شيراز": Destination.SHIRAZ,
    "طهران": Destination.TEHRAN,
    "جابهار": Destination.CHABAHAR,
    "كيش": Destination.KISH,
    "کیش": Destination.KISH,
    "جزيرةكيش": Destination.KISH,
    "جزيرة_كيش": Destination.KISH,
    "بندرعباس": Destination.BANDAR_ABBAS,
    "الأهواز": Destination.AHWAZ,
    "اهواز": Destination.AHWAZ,
    "مشهد": Destination.MASHHAD,
  };

  const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
  if (mapAr[raw]) return mapAr[raw];
  if (mapAr[compact]) return mapAr[compact];

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const phoneDigits = cleanPhoneDigits(body?.phone);
    const name = body?.name ? String(body.name) : null;
    const destination = normalizeDestination(body?.destination);

    if (!phoneDigits) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }
    if (!isValidPhoneDigits(phoneDigits)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }
    if (!destination) {
      return NextResponse.json({ ok: false, error: "invalid_destination" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { phone: phoneDigits } });

    if (existing) {
      const updated = await prisma.user.update({
        where: { phone: phoneDigits },
        data: {
          ...(name ? { name } : {}),
          destination,
        },
        select: { id: true, phone: true, refCode: true, points: true },
      });

      return NextResponse.json({ ok: true, user: updated, alreadyRegistered: true });
    }

    const base = makeRefCodeBase(phoneDigits);

    let created: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const refCode = attempt === 0 ? base : `${base}${shortRand(3)}`;
      try {
        created = await prisma.user.create({
          data: {
            phone: phoneDigits,
            name,
            destination,
            refCode,
            points: 0,
          },
          select: { id: true, phone: true, refCode: true, points: true },
        });
        break;
      } catch (e: any) {
        if (e?.code === "P2002") continue; // unique collision
        throw e;
      }
    }

    if (!created) {
      return NextResponse.json(
        { ok: false, error: "refcode_generation_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, user: created, alreadyRegistered: false });
  } catch (err) {
    console.error("REGISTER_ERROR", err);
    return NextResponse.json(
      { ok: false, message: "Registration failed. Try again." },
      { status: 500 }
    );
  }
}