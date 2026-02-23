"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REQUIRED_SHARES,
  getPhone,
  hasAnsweredQuestions,
  hasStarted,
} from "../lib/referral";

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

type DemoStep = {
  id: string;
  title: string;
  subtitle: string;
  done: boolean;
};

export default function ShareProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // from DB (optional display)
  const [points, setPoints] = useState<number>(0);
  const [joins, setJoins] = useState<number>(0);
  const [sharesCount, setSharesCount] = useState<number>(0);

  const [cooldownMinutes, setCooldownMinutes] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  // demo state
  const [demoActive, setDemoActive] = useState(false);
  const [demoPercent, setDemoPercent] = useState(0);
  const [steps, setSteps] = useState<DemoStep[]>([
    {
      id: "q",
      title: "تم تأكيد إجابات الأسئلة ✅",
      subtitle: "تم تسجيل اهتمامك بالسفر (مرة واحدة لكل رقم).",
      done: false,
    },
    {
      id: "share",
      title: "تم تسجيل المشاركة ✅",
      subtitle: "تم احتساب نقاط المشاركة وربطها برقمك.",
      done: false,
    },
    {
      id: "wa",
      title: "فتح واتساب لإرسال الرابط ✅",
      subtitle: "تم تجهيز الرسالة وفتح واتساب.",
      done: false,
    },
    {
      id: "friends",
      title: `إرسال إلى ${REQUIRED_SHARES} أصدقاء ✅`,
      subtitle: "بشكل تجريبي: نتحقق من عملية الإرسال...",
      done: false,
    },
    {
      id: "done",
      title: "تم تفعيل دخولك للقرعة الشهرية ✅",
      subtitle: "انتقل الآن للمرحلة الأخيرة واستلم كودك.",
      done: false,
    },
  ]);

  const phoneRef = useRef<string>("");

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

    return { points: p, joins: j, shares: computedShares };
  }

  // ✅ guards + initial load
  useEffect(() => {
    // must have started + phone
    if (!hasStarted()) {
      router.replace("/start");
      return;
    }

    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    // must answer questions first
    if (!hasAnsweredQuestions()) {
      router.replace("/questions");
      return;
    }

    phoneRef.current = phone;

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        await fetchCheck(phone);

        // step 1 is done (questions)
        setSteps((prev) => prev.map((s, idx) => (idx === 0 ? { ...s, done: true } : s)));
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

  // ✅ Start demo only if user came from Share click
  useEffect(() => {
    if (loading) return;

    const pending = sessionStorage.getItem("wa_pending_share") === "1";
    const untilRaw = sessionStorage.getItem("wa_cooldown_until");
    const until = Number(untilRaw || "0");

    if (!pending || !until) {
      setDemoActive(false);
      setDemoPercent(0);
      return;
    }

    // demo starts
    setDemoActive(true);

    const start = Date.now();
    const totalMs = Math.max(5_000, until - start); // fallback safety
    const stepsCount = 5;

    // mark step2 + step3 quickly (registered share + WhatsApp opened)
    setSteps((prev) =>
      prev.map((s, idx) => {
        if (idx === 1 || idx === 2) return { ...s, done: true };
        return s;
      })
    );

    const tick = async () => {
      const now = Date.now();
      const elapsed = now - start;
      const progress = clamp(elapsed / totalMs, 0, 1);
      const percent = Math.round(progress * 100);
      setDemoPercent(percent);

      // map progress -> which steps are done
      // step0 already done by questions
      // step1+2 already done immediately
      // step3 done after ~55%
      // step4 done at end
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx === 0) return s; // already set
          if (idx === 1 || idx === 2) return s; // already set
          if (idx === 3) {
            const done = progress >= 0.55;
            return done ? { ...s, done: true } : s;
          }
          if (idx === 4) {
            const done = progress >= 0.98;
            return done ? { ...s, done: true } : s;
          }
          return s;
        })
      );

      // finish
      if (progress >= 1) {
        // refresh points one last time (best-effort)
        try {
          await fetchCheck(phoneRef.current);
        } catch {}

        sessionStorage.removeItem("wa_pending_share");
        sessionStorage.removeItem("wa_cooldown_until");

        // optional: allow unlocked page to show "new entry" animation
        sessionStorage.setItem("entry_confirmed", "1");

        router.replace("/unlocked");
      }
    };

    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [loading, router]);

  const progressPercent = useMemo(() => {
    if (demoActive) return demoPercent;

    // fallback: show shares progress if user opened directly
    const v = (clamp(sharesCount, 0, REQUIRED_SHARES) / REQUIRED_SHARES) * 100;
    return Math.round(v);
  }, [demoActive, demoPercent, sharesCount]);

  const progressRightText = useMemo(() => {
    if (demoActive) return `${progressPercent}%`;
    return `${clamp(sharesCount, 0, REQUIRED_SHARES)} / ${REQUIRED_SHARES}`;
  }, [demoActive, progressPercent, sharesCount]);

  const statusTitle = useMemo(() => {
    if (demoActive) return "جارٍ تأكيد المشاركة... ⏳";
    if (sharesCount >= REQUIRED_SHARES) return "تم تفعيل دخولك للقرعة ✅";
    return "جاهز للمشاركة عبر واتساب";
  }, [demoActive, sharesCount]);

  const statusText = useMemo(() => {
    if (demoActive) {
      return "سيتم تفعيل دخولك تلقائياً بعد اكتمال المراحل.";
    }
    return `شارك الرابط لزيادة نقاطك — كلما زادت نقاطك زادت فرصتك في الفوز 🎯`;
  }, [demoActive]);

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-bold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نحدّث تقدّمك</div>
        </div>
      </main>
    );
  }

  const showNeedShare = !demoActive;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Step indicator (overall flow 4 steps) */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            خطوة 3 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-4">
            تقدّم المشاركة
          </h1>

          <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
            <span>{demoActive ? "المراحل" : "التقدّم"}</span>
            <span>{progressRightText}</span>
          </div>

          <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden mb-6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-orange-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-600 to-orange-400 flex items-center justify-center shadow-lg">
              <span className="text-3xl text-white">{demoActive ? "⏳" : "🔗"}</span>
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

          {/* ✅ 5 demo steps */}
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
            <div className="font-bold text-zinc-900 mb-3">✅ مراحل التفعيل</div>

            <div className="space-y-3">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-white border border-zinc-200 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{s.title}</div>
                    <div className="text-xs text-zinc-600 mt-1">{s.subtitle}</div>
                  </div>
                  <div className="text-xl">{s.done ? "✅" : demoActive ? "⏳" : "⬜"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules (no discount) */}
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="font-bold text-zinc-900 mb-2">📌 قواعد النقاط</div>
            <ul className="text-sm text-zinc-800 space-y-2">
              <li>✅ كل مشاركة للرابط = <b>1 نقطة</b></li>
              <li>👥 كل شخص يسجّل من رابطك = <b>+10 نقاط</b></li>
              <li>
                🎁 كلما زادت نقاطك = <b>فرصة أكبر</b> في الفوز بالقرعة الشهرية
              </li>
            </ul>
          </div>

          {/* Actions */}
          {showNeedShare ? (
            <>
              <button
                onClick={() => router.push("/share")}
                className="w-full mt-5 rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition"
              >
                مشاركة الرابط عبر واتساب
              </button>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  onClick={() => router.push("/check")}
                  className="rounded-2xl py-4 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
                >
                  عرض النقاط
                </button>

                <button
                  onClick={async () => {
                    try {
                      await fetchCheck(phoneRef.current);
                    } catch {
                      // ignore
                    }
                  }}
                  className="rounded-2xl py-4 bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition"
                >
                  تحديث
                </button>
              </div>

              <p className="text-center text-xs text-zinc-400 mt-4">
                (للتجربة) النقاط: {points} — الأصدقاء المنضمّون: {joins} — المشاركات المحسوبة:{" "}
                {sharesCount}
              </p>
            </>
          ) : (
            <button
              disabled
              className="w-full mt-5 rounded-2xl py-4 bg-zinc-200 text-zinc-600 font-bold cursor-not-allowed"
            >
              جارٍ التفعيل... ⏳
            </button>
          )}
        </div>
      </div>
    </main>
  );
}