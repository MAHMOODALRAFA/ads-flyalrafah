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
  hasAnsweredQuestions,
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

  const [qaDone, setQaDone] = useState(false);

  useEffect(() => {
    const s = hasStarted();
    setStarted(s);

    if (s) {
      const p = getPhone();
      setPhoneState(p);

      // questions state
      setQaDone(hasAnsweredQuestions());

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
      // fallback local remains
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

      // ✅ success: save phone + update UI state
      setPhone(p);
      setStarted(true);
      setPhoneState(p);
      setPoints(Number(data.user.points || 0));
      setQaDone(hasAnsweredQuestions()); // read from local for this device
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
    setQaDone(false);
    router.refresh();
  }

  function goPrimary() {
    // main CTA based on questions completion
    if (!started) {
      router.push("/start");
      return;
    }
    if (!qaDone) {
      router.push("/questions");
      return;
    }
    router.push("/share-progress");
  }

  function goShareNow() {
    if (!started) return router.push("/start");
    if (!qaDone) return router.push("/questions");
    router.push("/share");
  }

  const winnersText = useMemo(() => {
    // ✅ no discount language — raffle/prizes only
    const items = [
      "الفائزون هذا الشهر: محمود — تذكرة مجانية مسقط ⇄ شيراز 🎉",
      "الفائزون هذا الشهر: سالم — قسيمة سفر 50 ريال ✨",
      "الفائزون هذا الشهر: نورة — باقة هدايا سفر 🎁",
    ];
    return items.join("   •   ");
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-700 via-purple-500 to-yellow-400" />
      <div className="absolute inset-0 opacity-20 blur-3xl bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.20),transparent_50%)]" />

      {/* Background Decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-80px] top-[120px] h-[220px] w-[220px] rounded-full bg-white/10 blur-[1px]" />
        <div className="absolute right-[-90px] top-[220px] h-[260px] w-[260px] rounded-full bg-white/8 blur-[1px]" />
        <div className="absolute left-[40px] top-[420px] h-[140px] w-[140px] rounded-full bg-white/8 blur-[0.5px]" />
        <div className="absolute right-[70px] top-[520px] h-[120px] w-[120px] rounded-full bg-white/7 blur-[0.5px]" />

        <div className="absolute left-[55px] top-[180px] h-[18px] w-[70px] rounded-full bg-white/10" />
        <div className="absolute left-[120px] top-[250px] h-[16px] w-[52px] rounded-full bg-white/8" />
        <div className="absolute right-[120px] top-[170px] h-[18px] w-[74px] rounded-full bg-white/10" />
        <div className="absolute right-[60px] top-[310px] h-[16px] w-[56px] rounded-full bg-white/8" />

        <div className="absolute left-[120px] top-[95px] text-white/25 text-2xl">✦</div>
        <div className="absolute right-[95px] top-[120px] text-white/20 text-xl">✦</div>
        <div className="absolute right-[140px] top-[420px] text-white/20 text-2xl">✦</div>
        <div className="absolute left-[70px] top-[560px] text-white/15 text-xl">✦</div>

        <div className="absolute left-[-120px] bottom-[-120px] h-[320px] w-[320px] rounded-full bg-yellow-300/10 blur-3xl" />
        <div className="absolute right-[-140px] bottom-[-140px] h-[360px] w-[360px] rounded-full bg-purple-300/12 blur-3xl" />
      </div>

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
            ادخل قرعة FlyAlrafah الشهرية 🎉
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-white/90 leading-relaxed">
            شارك الرابط • اجمع نقاط • زِد فرصتك للفوز 🏆
          </p>

          {/* Cards */}
          <div className="w-full max-w-md mt-8 space-y-4">
            {/* Card 1 */}
            <div className="rounded-3xl px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)] border border-white/15">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                ⭐
              </div>
              <div className="font-extrabold text-xl">جمّع نقاطك وزِد فرصتك</div>
              <div className="mt-1 text-white/90 text-sm leading-relaxed">
                كل مشاركة تُضيف نقاط — وكل صديق يسجّل من رابطك يزيد فرصتك أكثر
              </div>

              <div className="mt-4 text-sm">
                <div className="rounded-2xl bg-white/15 border border-white/15 px-4 py-4 text-center">
                  <div className="text-white font-extrabold text-base">
                    شارك مع {5} من أصدقائك 🚀
                  </div>
                  <div className="text-white/85 mt-1">
                    بعدها يتم تفعيل دخولك للقرعة — واستمر للمزيد من النقاط ⭐
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-3xl px-6 py-5 bg-white/10 backdrop-blur-xl border border-white/25 text-white shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                🏆
              </div>
              <div className="font-extrabold text-xl">جوائز شهرية قوية</div>
              <div className="mt-1 text-white/85">
                كل شهر فائزين — تذاكر مجانية أو قسائم سفر ✨
              </div>
            </div>

            {/* Card 3: Lookup / Status */}
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
                      placeholder="أدخل رقم واتسابك"
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
                        {qaDone
                          ? "واصل المشاركة لزيادة فرصتك"
                          : "أكمل 3 أسئلة سريعة لتفعيل المشاركة"}
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
                        onClick={() => (qaDone ? router.push("/share") : router.push("/questions"))}
                        className="rounded-2xl py-3 bg-black/20 border border-white/20 text-white font-extrabold hover:bg-black/25 active:scale-[0.99] transition"
                      >
                        {qaDone ? "مشاركة الآن" : "أكمل الأسئلة"}
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
                  onClick={goPrimary}
                >
                  {qaDone ? "عرض تقدّمي" : "أكمل الأسئلة"}
                </button>
                <p className="text-center text-sm text-gray-600 mt-2">
                  {qaDone
                    ? "تابع نقاطك وواصل المشاركة لزيادة فرصتك"
                    : "أجب على 3 أسئلة سريعة ثم ابدأ بالمشاركة"}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}