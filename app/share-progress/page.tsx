"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REQUIRED_SHARES, getPhone } from "../lib/referral";

type CheckResponse =
  | {
      ok: true;
      user: {
        phone: string;
        name: string | null;
        destination: string | null;
        refCode: string;
        points: number;
        joins: number;
        lastShareAt: string | null;
        createdAt: string;
      };
      shareCooldown?: {
        isBlocked: boolean;
        waitMinutes: number;
        lastShareAt: string | null;
      };
    }
  | { ok: false; error: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ShareProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // ✅ معیار واقعی پیشرفت: تعداد Share های ثبت‌شده
  const [sharesCount, setSharesCount] = useState<number>(0);

  // فقط برای نمایش/شفافیت (به Unlock ربطی ندارد)
  const [points, setPoints] = useState<number>(0);
  const [joins, setJoins] = useState<number>(0);

  // اگر Share cooldown داشتی، اینجا نمایش می‌دیم
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  // ✅ حالت بررسی بعد از برگشت از واتس‌اپ
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const phoneRef = useRef<string>("");

  // ---------- helper: fetch + set state ----------
  async function fetchCheck(phone: string) {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as CheckResponse | null;

    if (!res.ok || !data || !data.ok) {
      throw new Error("bad_response");
    }

    const p = Number(data.user.points || 0);
    const j = Number(data.user.joins || 0);

    // ✅ چون: Share=1 point و Join=10 points
    // shares = points - joins*10
    const computedShares = Math.max(0, p - j * 10);

    setPoints(p);
    setJoins(j);
    setSharesCount(computedShares);

    const cd = data.shareCooldown;
    if (cd) {
      setIsBlocked(!!cd.isBlocked);
      setCooldownMinutes(Number(cd.waitMinutes || 0));
    } else {
      setIsBlocked(false);
      setCooldownMinutes(0);
    }
  }

  // ✅ Load from DB via /api/check (اولین بار)
  useEffect(() => {
    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    phoneRef.current = phone;

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        await fetchCheck(phone);
      } catch {
        if (!cancelled) router.replace("/start");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ✅ auto unlock after REQUIRED_SHARES
  useEffect(() => {
    if (!loading && sharesCount >= REQUIRED_SHARES) {
      const t = setTimeout(() => router.push("/unlocked"), 700);
      return () => clearTimeout(t);
    }
  }, [sharesCount, loading, router]);

  // ✅ وقتی برگشت از واتس‌اپ (tab فعال شد) شروع به بررسی کنیم
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        const pending = sessionStorage.getItem("wa_pending_share") === "1";
        if (pending && !checkingRef.current) {
          startAutoCheck();
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ تابع بررسی 60 ثانیه‌ای
  async function startAutoCheck() {
    const phone = phoneRef.current;
    if (!phone) return;

    checkingRef.current = true;
    setChecking(true);

    const startedAt = Date.now();
    const timeoutMs = 60_000;
    const intervalMs = 3_000;

    // همون لحظه یک بار چک
    try {
      await fetchCheck(phone);
    } catch {
      // اگر خطا شد باز هم ادامه می‌دهیم تا تایم‌اوت
    }

    const timer = setInterval(async () => {
      const elapsed = Date.now() - startedAt;

      try {
        await fetchCheck(phone);

        // اگر به حد لازم رسید، auto unlock useEffect انجام می‌دهد
        if (sharesCount >= REQUIRED_SHARES) {
          clearInterval(timer);
          checkingRef.current = false;
          setChecking(false);
          sessionStorage.removeItem("wa_pending_share");
          return;
        }
      } catch {
        // ادامه بده
      }

      if (elapsed >= timeoutMs) {
        clearInterval(timer);
        checkingRef.current = false;
        setChecking(false);
        sessionStorage.removeItem("wa_pending_share");
      }
    }, intervalMs);
  }

  const progressPercent = useMemo(() => {
    const v = (clamp(sharesCount, 0, REQUIRED_SHARES) / REQUIRED_SHARES) * 100;
    return Math.round(v);
  }, [sharesCount]);

  const remaining = useMemo(() => {
    return Math.max(0, REQUIRED_SHARES - clamp(sharesCount, 0, REQUIRED_SHARES));
  }, [sharesCount]);

  const statusTitle = useMemo(() => {
    if (checking) return "جارٍ التحقق... ⏳";
    if (sharesCount <= 0) return "ابدأ بالمشاركة الآن";
    if (sharesCount >= REQUIRED_SHARES) return "تم تفعيل الدخول للسحب ✅";
    return "✅ تم تسجيل مشاركة";
  }, [sharesCount, checking]);

  const statusText = useMemo(() => {
    if (sharesCount >= REQUIRED_SHARES) {
      return "ممتاز! سيتم نقلك الآن للمرحلة الأخيرة...";
    }
    if (checking) {
      return "انتظر لحظات... نراجع مشاركتك (قد يستغرق حتى دقيقة واحدة)";
    }
    return `شارك الرابط ${remaining} مرات أخرى للدخول في السحب الشهري`;
  }, [sharesCount, remaining, checking]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-zinc-50 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-bold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نحدّث تقدّمك</div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-zinc-50 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            خطوة 3 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-4">
            تقدّم المشاركة
          </h1>

          {/* Progress header */}
          <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
            <span>{progressPercent}%</span>
            <span>
              {clamp(sharesCount, 0, REQUIRED_SHARES)} / {REQUIRED_SHARES}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden mb-6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-orange-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Center icon */}
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-600 to-orange-400 flex items-center justify-center shadow-lg">
              <span className="text-3xl text-white">🔗</span>
            </div>
          </div>

          {/* Status box */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
            <div className="text-lg font-semibold text-zinc-900">{statusTitle}</div>
            <div className="text-sm text-zinc-700 mt-1">{statusText}</div>

            {isBlocked && cooldownMinutes > 0 ? (
              <div className="text-xs text-zinc-500 mt-2">
                ⏳ ملاحظة: انتظر {cooldownMinutes} دقيقة قبل احتساب نقطة مشاركة جديدة.
              </div>
            ) : null}
          </div>

          {/* Rules box */}
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
            <div className="font-bold text-zinc-900 mb-2">📌 قواعد النقاط</div>
            <ul className="text-sm text-zinc-800 space-y-2">
              <li>✅ كل مشاركة للرابط = <b>1 نقطة</b></li>
              <li>👥 كل شخص يسجّل من رابطك = <b>+10 نقاط</b></li>
              <li>🎁 بعد 3 مشاركات، يتم تسجيل اسمك في <b>السحب الشهري</b></li>
            </ul>
          </div>

          {/* Actions */}
          <button
            onClick={() => {
              // یک کلیک → برو واتس‌اپ (صفحه /share)
              // و وقتی برگشت، auto-check شروع میشه
              sessionStorage.setItem("wa_pending_share", "1");
              router.push("/share");
            }}
            disabled={checking}
            className="w-full mt-5 rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition disabled:opacity-60 disabled:hover:bg-green-500"
          >
            {checking ? "جارٍ التحقق..." : "مشاركة الرابط عبر واتساب"}
          </button>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => router.push("/check")}
              className="rounded-2xl py-4 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
            >
              عرض النقاط
            </button>

            <button
              onClick={() => {
                // دستی هم اگر خواست، یک بار چک کن
                startAutoCheck();
              }}
              disabled={checking}
              className="rounded-2xl py-4 bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition disabled:opacity-60"
            >
              {checking ? "..." : "تحديث الصفحة"}
            </button>
          </div>

          {/* Tiny debug (اختیاری) */}
          <p className="text-center text-xs text-zinc-400 mt-4">
            (للتجربة) النقاط: {points} — الأصدقاء المنضمّون: {joins} — المشاركات المحسوبة:{" "}
            {sharesCount}
          </p>
        </div>
      </div>
    </main>
  );
}
