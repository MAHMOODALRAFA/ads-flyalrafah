"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasStarted,
  getPhone,
  getShareCount,
  setPhone,
  resetAll,
} from "@/app/lib/referral";

type MeResponse =
  | {
      ok: true;
      user: {
        phone: string;
        name: string | null;
        destination: string | null;
        refCode: string;
        points: number;
      };
    }
  | { ok: false; error: string };

function normalizePhone(input: string) {
  let x = (input || "").trim();
  x = x.replace(/[^\d+]/g, "");
  return x;
}

export default function HomePage() {
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [phone, setPhoneState] = useState("");
  const [points, setPoints] = useState<number>(0);
  const [pointsLoading, setPointsLoading] = useState(false);

  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string>("");

  useEffect(() => {
    const s = hasStarted();
    setStarted(s);

    if (s) {
      const p = getPhone();
      setPhoneState(p);

      // fallback local
      setPoints(getShareCount());

      // fetch from DB
      fetchPointsFromDb(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPointsFromDb(p: string) {
    if (!p) return;

    setPointsLoading(true);
    try {
      const res = await fetch(`/api/me?phone=${encodeURIComponent(p)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as MeResponse | null;

      if (res.ok && data && data.ok && data.user) {
        setPoints(Number(data.user.points || 0));
      }
    } catch {
      // fallback local باقی می‌ماند
    } finally {
      setPointsLoading(false);
    }
  }

  async function lookupPoints() {
    const p = normalizePhone(lookupPhone);
    setLookupError("");

    if (!p || p.length < 7) {
      setLookupError("يرجى إدخال رقم صحيح");
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(`/api/me?phone=${encodeURIComponent(p)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as MeResponse | null;

      if (!res.ok || !data) {
        setLookupError("حدث خطأ، حاول مرة أخرى");
        return;
      }

      if (!data.ok) {
        if (data.error === "not_found") {
          setLookupError("هذا الرقم غير مسجل — اضغط (ابدأ الآن) للتسجيل");
        } else if (data.error === "missing_phone") {
          setLookupError("يرجى إدخال رقمك");
        } else {
          setLookupError("تعذر جلب البيانات");
        }
        return;
      }

      // ✅ نجاح: حفظ الرقم وتفعيل حالة B
      setPhone(p);
      setStarted(true);
      setPhoneState(p);
      setPoints(Number(data.user.points || 0));
    } catch {
      setLookupError("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleLogout() {
    resetAll();
    setStarted(false);
    setPhoneState("");
    setPoints(0);
    setLookupPhone("");
    setLookupError("");
    router.refresh();
  }

  const winnersText = useMemo(() => {
    const items = [
            "الفائزون هذا الشهر: محمود — تذكرة مجانية مسقط ⇄ شيراز 🎉",
      "الفائزون هذا الشهر: محمود — تذكرة مجانية مسقط ⇄ شيراز 🎉",
      "الفائزون هذا الشهر: سالم — خصم 10 ريال ✨",
      "الفائزون هذا الشهر: نورة — قسيمة 50 ريال 🎁",
    ];
    return items.join("   •   ");
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-700 via-purple-500 to-yellow-400" />
      <div className="absolute inset-0 opacity-20 blur-3xl bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.20),transparent_50%)]" />

      <div className="relative z-10 min-h-screen flex flex-col px-6 pb-28">
        {/* Logo */}
        <div className="pt-10 pb-4">
          <div className="mx-auto w-full max-w-md flex items-center justify-center">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-black/10">
              <Image
                src="/logo.png"
                alt="FlyAlrafah"
                width={200}
                height={72}
                className="h-16 w-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Winners strip */}
        <div className="mx-auto w-full max-w-md">
          <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/10 backdrop-blur-xl">
            <div className="px-4 py-2 text-xs text-white/90">
<div className="fly-marquee">
  <div className="flex shrink-0">
    <span className="pe-12">{winnersText}</span>
  </div>

  <div className="flex shrink-0">
    <span className="pe-12">{winnersText}</span>
  </div>
</div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-purple-700/60 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-yellow-400/40 to-transparent" />
          </div>
        </div>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-start text-center pt-6">
          <h1 className="text-[40px] sm:text-5xl font-extrabold text-white leading-[1.2] tracking-tight">
            احصل على خصم فوري على تذكرة سفرك 🎉
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-white/90 leading-relaxed">
            شارك الرابط وجمّع نقاطك للدخول في السحب
          </p>

          {/* Cards */}
          <div className="w-full max-w-md mt-8 space-y-4">
            {/* Card 1 */}
            <div className="rounded-3xl px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)] border border-white/15">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                💳
              </div>
              <div className="font-extrabold text-xl">جمّع نقاطك وخذ خصمك</div>
              <div className="mt-1 text-white/90 text-sm leading-relaxed">
                شارك الرابط وسجّل أصدقائك — وكلما زادت نقاطك زادت فرصتك
              </div>

              {/* ✅ single merged box */}
              <div className="mt-4 text-sm">
                <div className="rounded-2xl bg-white/15 border border-white/15 px-4 py-4 text-center">
                  <div className="text-white font-extrabold text-base">
                    شارك مع 10 من أصدقائك 🚀
                  </div>
                  <div className="text-white/85 mt-1">
                    واحصل على أقوى خصم عند اكتمال 10 تسجيلات ⭐
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-3xl px-6 py-5 bg-white/10 backdrop-blur-xl border border-white/25 text-white shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                ✨
              </div>
              <div className="font-extrabold text-xl">
                سحب على 500 ريال أو تذكرة مجانية
              </div>
              <div className="mt-1 text-white/85">ادخل السحب تلقائياً</div>
            </div>

            {/* Card 3 FINAL */}
            <div className="rounded-3xl px-6 py-5 text-white shadow-[0_18px_50px_rgba(0,0,0,0.22)] border border-white/20 bg-gradient-to-br from-fuchsia-600/70 via-purple-600/55 to-amber-400/40 backdrop-blur-xl ring-1 ring-white/25 relative overflow-hidden text-right">
              <div className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-black/10 blur-2xl" />

              {!started ? (
                <>
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs">
                        ✨ تحقق سريع
                      </div>
                      <div className="mt-2 font-extrabold text-xl">عرض نقاطي</div>
                      <div className="mt-1 text-sm text-white/90">
                        أدخل رقم واتسابك لمراجعة نقاطك
                      </div>
                    </div>

                    <div className="h-10 w-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg">
                      🏅
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 relative z-10">
                    <input
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      placeholder="+968XXXXXXXX"
                      dir="ltr"
                      inputMode="tel"
                      className="flex-1 rounded-2xl px-4 py-3 bg-white/12 border border-white/20 text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <button
                      onClick={lookupPoints}
                      disabled={lookupLoading}
                      className="shrink-0 rounded-2xl px-5 py-3 bg-white text-purple-700 font-extrabold shadow-[0_20px_60px_rgba(255,255,255,0.25)] disabled:opacity-70 active:scale-[0.99] transition"
                    >
                      {lookupLoading ? "..." : "عرض"}
                    </button>
                  </div>

                  {lookupError && (
                    <div className="mt-3 rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-white relative z-10">
                      {lookupError}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-white/80 relative z-10">
                    <span>إذا لم تكن مسجلاً بعد</span>
                    <button
                      onClick={() => router.push("/start")}
                      className="underline underline-offset-4 hover:text-white transition"
                    >
                      ابدأ الآن
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs">
                        ✅ نقاطك الآن
                      </div>
                      <div className="mt-2 font-extrabold text-xl">نقاطك الحالية</div>
                      <div className="mt-1 text-sm text-white/90">
                        تابع نقاطك وواصل المشاركة لزيادة فرصتك
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchPointsFromDb(phone)}
                        className="h-10 rounded-2xl px-4 bg-white/15 border border-white/20 hover:bg-white/20 transition text-xs font-bold"
                      >
                        {pointsLoading ? "..." : "تحديث"}
                      </button>

                      <button
                        onClick={handleLogout}
                        className="h-10 rounded-2xl px-4 bg-black/20 border border-white/20 hover:bg-black/25 transition text-xs font-extrabold"
                      >
                        تسجيل الخروج
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white/12 border border-white/20 px-4 py-4 relative z-10">
                    <div className="text-xs text-white/80">رقمك</div>
                    <div className="mt-1 text-sm text-white/95 font-semibold" dir="ltr">
                      {phone || "—"}
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 px-4 py-4">
                      <div className="text-xs text-white/80">النقاط</div>
                      <div className="mt-1 text-4xl font-extrabold leading-none">
                        {points}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => router.push("/check")}
                        className="rounded-2xl py-3 bg-white text-purple-700 font-extrabold shadow-[0_18px_50px_rgba(255,255,255,0.18)] active:scale-[0.99] transition"
                      >
                        عرض النقاط
                      </button>

                      <button
                        onClick={() => router.push("/share")}
                        className="rounded-2xl py-3 bg-black/20 border border-white/20 text-white font-extrabold hover:bg-black/25 active:scale-[0.99] transition"
                      >
                        مشاركة الآن
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="px-6 pb-8 pt-6 bg-white/90 backdrop-blur-xl shadow-[0_-20px_60px_rgba(0,0,0,0.25)]">
            {!started ? (
              <>
                <button
                  className="w-full rounded-3xl py-4 font-extrabold text-purple-700 bg-white shadow-[0_20px_60px_rgba(124,58,237,0.25)] active:scale-[0.99] transition"
                  onClick={() => router.push("/start")}
                >
                  ابدأ الآن
                </button>
                <p className="text-center text-sm text-gray-600 mt-2">
                  يستغرق أقل من 30 ثانية
                </p>
              </>
            ) : (
              <>
                <button
                  className="w-full rounded-3xl py-4 font-extrabold text-purple-700 bg-white shadow-[0_20px_60px_rgba(124,58,237,0.25)] active:scale-[0.99] transition"
                  onClick={() => router.push("/share-progress")}
                >
                  عرض نقاطي
                </button>
                <p className="text-center text-sm text-gray-600 mt-2">
                  تابع نقاطك وواصل المشاركة لزيادة فرصتك
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
    </div>
  );
}
