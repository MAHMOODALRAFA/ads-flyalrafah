// app/share-progress/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAnsweredQuestions } from "../lib/referral";

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
        sharesGiven?: number;
        lastShareAt: string | null;
        createdAt: string;
      };
      shareCooldown?: {
        isBlocked: boolean;
        cooldownRemainingSec?: number;
        waitMinutes?: number;
        lastShareAt: string | null;
      };
    }
  | { ok: false; error: string };

const VERIFY_SHARE_MS = 40_000; // ✅ 40 seconds
const FINALIZE_MS = 15_000; // ✅ 15 seconds

type Stage = "loading" | "need_share" | "verifying_share" | "need_ig" | "finalizing";

type ConsoleLine = {
  id: string;
  text: string;
  level: "info" | "ok" | "warn";
};

export default function ShareProgressPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [pct, setPct] = useState(0);

  const [phone, setPhone] = useState("");
  const [sharesGiven, setSharesGiven] = useState(0);
  const [igDone, setIgDone] = useState(false);

  // UI-only: fake console + rotating promo
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoIndex, setPromoIndex] = useState(0);

  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);
  const promoIntervalRef = useRef<number | null>(null);
  const consoleIntervalRef = useRef<number | null>(null);

  const IG_KEY = useMemo(() => `flyalrafah_instagram_done__${phone || "unknown"}`, [phone]);

  const PROMOS = useMemo(
    () => [
      "⭐ نقاط أكثر = فرصة أكبر للفوز — استمر بالمشاركة!",
      "👥 كل صديق ينضم من رابطك يعطيك +10 نقاط (دخول أقوى للقرعة).",
      "⏳ نستخدم مراجعة زمنية بسيطة لضمان جودة المشاركات ومنع الإساءة.",
      "🎯 نصيحة: شارك الرابط مع مجموعات العائلة/الأصدقاء لزيادة فرصتك بسرعة.",
      "✅ لا تقلق: حتى لو خرجت من الصفحة، بياناتك محفوظة على النظام.",
    ],
    []
  );

  function pushTimer(id: number) {
    timersRef.current.push(id);
  }

  function clearAllTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (promoIntervalRef.current) window.clearInterval(promoIntervalRef.current);
    promoIntervalRef.current = null;

    if (consoleIntervalRef.current) window.clearInterval(consoleIntervalRef.current);
    consoleIntervalRef.current = null;
  }

  function startProgress(durationMs: number, fromPct: number, toPct: number) {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;

    setPct(fromPct);

    const start = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const next = Math.round(fromPct + (toPct - fromPct) * t);
      setPct(next);
      if (t >= 1 && intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 200);
  }

  function addConsoleLine(text: string, level: ConsoleLine["level"] = "info") {
    setConsoleLines((prev) => {
      const next = [
        ...prev,
        { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, text, level },
      ];
      // keep last 10
      return next.slice(-10);
    });
  }

  function resetConsoleForStage(s: Stage) {
    // small staged “story” but purely UI
    const base: ConsoleLine[] = [
      { id: "a", text: "Initializing activation flow…", level: "info" },
      { id: "b", text: "Validating session token…", level: "info" },
      { id: "c", text: "Loading user stats…", level: "info" },
    ];

    const stageHint: Record<Stage, ConsoleLine[]> = {
      loading: [{ id: "s1", text: "Preparing activation status…", level: "info" }],
      need_share: [
        { id: "s2", text: "Waiting for first WhatsApp share event…", level: "warn" },
        { id: "s3", text: "Tip: share once then return here.", level: "info" },
      ],
      verifying_share: [
        { id: "s4", text: "Reviewing WhatsApp send signal…", level: "info" },
        { id: "s5", text: "Cross-checking cooldown & counters…", level: "info" },
      ],
      need_ig: [
        { id: "s6", text: "Share verified ✅", level: "ok" },
        { id: "s7", text: "Next: Instagram follow required.", level: "warn" },
      ],
      finalizing: [
        { id: "s8", text: "Finalizing entry…", level: "info" },
        { id: "s9", text: "Generating last confirmation…", level: "info" },
      ],
    };

    setConsoleLines([...base, ...(stageHint[s] || [])].slice(-10));
  }

  async function fetchCheck(): Promise<{ phone: string; shares: number }> {
    const res = await fetch("/api/check", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await res.json().catch(() => null)) as CheckResponse | null;

    if (!res.ok || !data) throw new Error("bad_response");

    if (data.ok === false) {
      if (data.error === "unauthorized" || data.error === "invalid_session") {
        router.replace("/start");
        throw new Error("session");
      }
      throw new Error(data.error);
    }

    const p = data.user.phone || "";
    const s = Number(data.user.sharesGiven ?? 0) || 0;

    setPhone(p);
    setSharesGiven(s);

    return { phone: p, shares: s };
  }

  // ✅ Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStage("loading");
        setPct(0);
        resetConsoleForStage("loading");

        // local UX gate
        if (!hasAnsweredQuestions()) {
          router.replace("/questions");
          return;
        }

        addConsoleLine("Session gate passed ✅", "ok");

        const stats = await fetchCheck();
        if (cancelled) return;

        addConsoleLine(`User loaded: ${stats.phone || "unknown"}`, "ok");
        addConsoleLine(`Shares recorded: ${stats.shares}`, "info");

        const ig = stats.phone
          ? localStorage.getItem(`flyalrafah_instagram_done__${stats.phone}`) === "1"
          : false;
        setIgDone(ig);

        if (ig) addConsoleLine("Instagram flag: done ✅", "ok");
        else addConsoleLine("Instagram flag: pending", "warn");

        // ✅ must have at least 1 share recorded in system
        if (stats.shares < 1) {
          setStage("need_share");
          setPct(10);
          resetConsoleForStage("need_share");
          return;
        }

        // ✅ When user comes from WA share button, run the 40s verification
        const pending = sessionStorage.getItem("wa_pending_share") === "1";
        if (pending) sessionStorage.removeItem("wa_pending_share");

        // Even if not pending, we can still show need_ig directly (since share is done)
        if (!pending) {
          setStage(ig ? "finalizing" : "need_ig");
          setPct(ig ? 85 : 70);
          resetConsoleForStage(ig ? "finalizing" : "need_ig");

          if (ig) {
            startProgress(FINALIZE_MS, 85, 100);
            addConsoleLine("Final step started…", "info");

            pushTimer(
              window.setTimeout(() => {
                sessionStorage.setItem("entry_confirmed", "1");
                addConsoleLine("Redirecting to unlocked…", "ok");
                router.replace("/unlocked");
              }, FINALIZE_MS)
            );
          }

          return;
        }

        setStage("verifying_share");
        resetConsoleForStage("verifying_share");
        startProgress(VERIFY_SHARE_MS, 10, 70);

        addConsoleLine("Verification timer started (40s)…", "info");

        pushTimer(
          window.setTimeout(async () => {
            try {
              const fresh = await fetchCheck();
              addConsoleLine(`Re-check shares: ${fresh.shares}`, "ok");

              if (fresh.shares < 1) {
                setStage("need_share");
                setPct(10);
                resetConsoleForStage("need_share");
                return;
              }
            } catch {
              addConsoleLine("Re-check failed, continuing flow…", "warn");
            }

            // after 40s go to IG step
            const ig2 = stats.phone
              ? localStorage.getItem(`flyalrafah_instagram_done__${stats.phone}`) === "1"
              : false;
            setIgDone(ig2);

            if (ig2) {
              setStage("finalizing");
              resetConsoleForStage("finalizing");
              startProgress(FINALIZE_MS, 70, 100);
              addConsoleLine("Instagram already done. Finalizing…", "ok");

              pushTimer(
                window.setTimeout(() => {
                  sessionStorage.setItem("entry_confirmed", "1");
                  addConsoleLine("Redirecting to unlocked…", "ok");
                  router.replace("/unlocked");
                }, FINALIZE_MS)
              );
            } else {
              setStage("need_ig");
              setPct(70);
              resetConsoleForStage("need_ig");
              addConsoleLine("Waiting Instagram follow…", "warn");
            }
          }, VERIFY_SHARE_MS)
        );
      } catch {
        if (!cancelled) router.replace("/start");
      }
    })();

    return () => {
      cancelled = true;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Keep IG state synced when phone becomes available
  useEffect(() => {
    if (!phone) return;
    setIgDone(localStorage.getItem(IG_KEY) === "1");
  }, [phone, IG_KEY]);

  // UI-only: enable promos if user stays ~45s on this page
  useEffect(() => {
    const id = window.setTimeout(() => setPromoEnabled(true), 45_000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!promoEnabled) return;
    if (promoIntervalRef.current) window.clearInterval(promoIntervalRef.current);

    promoIntervalRef.current = window.setInterval(() => {
      setPromoIndex((i) => (i + 1) % PROMOS.length);
    }, 8_000);

    return () => {
      if (promoIntervalRef.current) window.clearInterval(promoIntervalRef.current);
      promoIntervalRef.current = null;
    };
  }, [promoEnabled, PROMOS.length]);

  // UI-only: keep console “alive” with tiny heartbeat while verifying/finalizing
  useEffect(() => {
    if (consoleIntervalRef.current) window.clearInterval(consoleIntervalRef.current);
    consoleIntervalRef.current = null;

    if (stage !== "verifying_share" && stage !== "finalizing") return;

    const ticks =
      stage === "verifying_share"
        ? [
            "Analyzing delivery pattern…",
            "Scanning share counters…",
            "Checking anti-abuse heuristics…",
            "Syncing activity log…",
          ]
        : ["Sealing entry…", "Saving confirmation…", "Preparing final redirect…"];

    let k = 0;
    consoleIntervalRef.current = window.setInterval(() => {
      addConsoleLine(ticks[k % ticks.length], "info");
      k += 1;
    }, 4500);

    return () => {
      if (consoleIntervalRef.current) window.clearInterval(consoleIntervalRef.current);
      consoleIntervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function handleGoShare() {
    sessionStorage.setItem("wa_pending_share", "1");
    router.push("/share");
  }

  function handleInstagramFollow() {
    if (!phone) return;

    window.open("https://instagram.com/flyalrafah", "_blank");

    localStorage.setItem(IG_KEY, "1");
    setIgDone(true);

    addConsoleLine("Instagram follow clicked ✅", "ok");

    setStage("finalizing");
    resetConsoleForStage("finalizing");
    startProgress(FINALIZE_MS, 70, 100);

    pushTimer(
      window.setTimeout(() => {
        sessionStorage.setItem("entry_confirmed", "1");
        addConsoleLine("Redirecting to unlocked…", "ok");
        router.replace("/unlocked");
      }, FINALIZE_MS)
    );
  }

  const title = useMemo(() => {
    if (stage === "loading") return "جارٍ التحميل...";

    if (stage === "need_share") {
      // قبل أول مشاركة: نطلب مشاركة واحدة فقط
      return "مشاركة واحدة مطلوبة أولاً";
    }

    if (stage === "verifying_share") {
      // ✅ قبل أول Share: نستخدم نص “5 أصدقاء” (كحملة)
      // ✅ بعد التفعيل (sharesGiven >= 1): نص عام بدون رقم
      return sharesGiven >= 1
        ? "جارٍ التحقق من الإرسال..."
        : "جارٍ التحقق من الإرسال إلى 5 أصدقاء";
    }

    if (stage === "need_ig") return "شرط إنستغرام 📲";

    return "جارٍ إكمال التفعيل...";
  }, [stage, sharesGiven]);

  const subtitle = useMemo(() => {
    if (stage === "need_share")
      return "اضغط مشاركة الرابط مرة واحدة عبر واتساب ثم ارجع هنا لإكمال التفعيل.";

    if (stage === "verifying_share") {
      return sharesGiven >= 1
        ? "نقوم بمراجعة عملية الإرسال (فقط للتأكد) — انتظر قليلاً."
        : "نقوم بمراجعة عملية الإرسال إلى الأصدقاء (فقط للتأكد) — انتظر قليلاً.";
    }

    if (stage === "need_ig")
      return "اضغط للمتابعة على إنستغرام لإكمال التفعيل ثم سننقلك لصفحة الكود.";

    if (stage === "finalizing") return "لحظات وننقلك لصفحة الكود ✅";

    return "نجهّز حالة التفعيل";
  }, [stage, sharesGiven]);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-extrabold text-center text-zinc-900">{title}</h1>
          <p className="text-center text-sm text-zinc-500 mt-2 mb-5">{subtitle}</p>

          {/* Progress bar فقط */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">التقدّم</div>
              <div className="text-xs font-bold text-zinc-800">{pct}%</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          {stage === "need_share" && (
            <button
              onClick={handleGoShare}
              className="w-full mt-2 py-3 rounded-2xl bg-zinc-900 text-white font-extrabold shadow-md hover:opacity-95 transition"
            >
              مشاركة الرابط عبر واتساب
            </button>
          )}

          {stage === "need_ig" && (
            <button
              onClick={handleInstagramFollow}
              className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold shadow-md hover:opacity-95 transition"
            >
              متابعة إنستغرام الآن
            </button>
          )}

          {/* Small footer (kept minimal) */}
          <div className="mt-4 text-xs text-zinc-500 text-center">
            المشاركات المسجلة: <span className="font-bold text-zinc-900">{sharesGiven}</span>
            {" • "}
            إنستغرام: <span className="font-bold text-zinc-900">{igDone ? "✅" : "—"}</span>
          </div>
        </div>



        {/* Promo Rotator (UI-only) */}
        <div className="bg-white rounded-2xl shadow-lg p-5 border border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <div className="font-extrabold text-zinc-900">نصائح سريعة</div>
            <div className="text-xs text-zinc-500">{promoEnabled ? "مباشر" : "قريباً"}</div>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
            <div className="text-sm font-bold text-zinc-900">
              {promoEnabled ? PROMOS[promoIndex] : "⏳ بعد قليل ستظهر نصائح تساعدك لرفع فرصتك…"}
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              لا تغيّر الصفحة—استمر، كل خطوة تقرّبك من التفعيل ✅
            </div>
          </div>
        </div>

  {/* Banner Slot (same “block” vibe) */}
<div className="bg-white rounded-2xl shadow-lg p-5 border border-zinc-200">
  <div className="font-extrabold text-zinc-900 mb-2">اعلان</div>

  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 p-3">
    <a
      href="https://flyalrafah.com/?lang=en"
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <img
        src="https://i.ibb.co/Gf3wrq7y/Chat-GPT-Image-Feb-27-2026-07-13-31-PM.png"
        alt="FlyAlrafah Banner"
        className="w-full h-auto rounded-xl object-cover"
      />
    </a>
  </div>
        </div>
      </div>
    </main>
  );
}