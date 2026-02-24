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

type DemoStep = {
  id: "q" | "share" | "wa" | "friends" | "ig" | "done";
  title: string;
  subtitle: string;
  done: boolean;
};

const IG_KEY = (phone: string) => `flyalrafah_instagram_done_${phone || "unknown"}`;
const LEGACY_IG_KEY = "flyalrafah_instagram_done"; // قدیمی (برای پاکسازی)
// ✅ 1 minute total verification split
const PHASE1_MS = 20_000; // share + wa
const PHASE2_MS = 20_000; // friends
const PHASE3_MS = 20_000; // IG + finalize
const TOTAL_MS = PHASE1_MS + PHASE2_MS + PHASE3_MS;

export default function ShareProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [points, setPoints] = useState<number>(0);
  const [joins, setJoins] = useState<number>(0);
  const [sharesCount, setSharesCount] = useState<number>(0);

  const [igDone, setIgDone] = useState(false);

  // UI states
  const [verifying, setVerifying] = useState(false);
  const [verifyText, setVerifyText] = useState<string>("");
  const [verifyPct, setVerifyPct] = useState<number>(0);

  const [igVerifying, setIgVerifying] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [steps, setSteps] = useState<DemoStep[]>([
    {
      id: "q",
      title: "تم تأكيد إجابات الأسئلة",
      subtitle: "تم تسجيل اهتمامك بالسفر.",
      done: false,
    },
    {
      id: "share",
      title: "تم تسجيل المشاركة",
      subtitle: "نقوم بمراجعة نقاط المشاركة...",
      done: false,
    },
    {
      id: "wa",
      title: "فتح واتساب لإرسال الرابط",
      subtitle: "نقوم بتأكيد فتح واتساب...",
      done: false,
    },
    {
      id: "friends",
      title: `إرسال إلى ${REQUIRED_SHARES} أصدقاء`,
      subtitle: "نقوم بالتحقق من عملية الإرسال...",
      done: false,
    },
    {
      id: "ig",
      title: "متابعة إنستغرام FlyAlrafah",
      subtitle: "اضغط للمتابعة ثم نُكمل التفعيل.",
      done: false,
    },
    {
      id: "done",
      title: "تم تفعيل دخولك للقرعة الشهرية",
      subtitle: "جارٍ تجهيز صفحتك الأخيرة...",
      done: false,
    },
  ]);

  const phoneRef = useRef<string>("");
  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  function pushTimer(id: number) {
    timersRef.current.push(id);
  }

  function clearAllTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

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
    // same formula you used
    const computedShares = Math.max(0, p - j * 10);

    setPoints(p);
    setJoins(j);
    setSharesCount(computedShares);

    return { points: p, joins: j, shares: computedShares };
  }

  function markDone(ids: DemoStep["id"][], subtitle?: string) {
    setSteps((prev) =>
      prev.map((s) =>
        ids.includes(s.id)
          ? { ...s, done: true, subtitle: subtitle ?? s.subtitle }
          : s
      )
    );
  }

  // ✅ Guards + init
  useEffect(() => {
    if (!hasStarted()) {
      router.replace("/start");
      return;
    }

    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    if (!hasAnsweredQuestions()) {
      router.replace("/questions");
      return;
    }

    phoneRef.current = phone;

const key = IG_KEY(phone);

// پاکسازی کلید قدیمی تا روی شماره‌های جدید اثر نگذارد
if (localStorage.getItem(LEGACY_IG_KEY) === "1" && localStorage.getItem(key) !== "1") {
  localStorage.removeItem(LEGACY_IG_KEY);
}

const ig = localStorage.getItem(key) === "1";
setIgDone(ig);

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const stats = await fetchCheck(phone);

        if (cancelled) return;

        // ✅ q always done
        markDone(["q"], "تم الحفظ بنجاح.");

        // ✅ If IG already done (previous session)
        if (ig) {
          markDone(["ig"], "تم التفعيل ✅");
        }

        // ✅ IMPORTANT: if user refreshes or enters directly (no pending flag),
        // infer done steps from server sharesCount so IG block can appear.
        if (stats.shares > 0) {
          markDone(["share", "wa"], "تم التحقق بنجاح ✅");
        }
        if (stats.shares >= REQUIRED_SHARES) {
          markDone(["friends"], "تم التحقق بنجاح ✅");
        }
      } catch {
        if (!cancelled) router.replace("/start");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const sharePartDone = useMemo(() => {
    const ids: DemoStep["id"][] = ["q", "share", "wa", "friends"];
    return steps.filter((s) => ids.includes(s.id)).every((s) => s.done);
  }, [steps]);

  // ✅ After coming from /share: run 1-minute verification split
  useEffect(() => {
    if (loading) return;

    const pending = sessionStorage.getItem("wa_pending_share") === "1";
    if (!pending) return;

    // prevent repeat
    sessionStorage.removeItem("wa_pending_share");

    clearAllTimers();
    setVerifying(true);
    setVerifyPct(0);

    const start = Date.now();

    setVerifyText("جارٍ التحقق من المشاركة...");

    // progress ticker
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
      setVerifyPct(pct);
    }, 250);

    // Phase 1: share+wa
    pushTimer(
      window.setTimeout(() => {
        markDone(["share", "wa"], "تم التحقق بنجاح ✅");
        setVerifyText("جارٍ التحقق من الإرسال للأصدقاء...");
      }, PHASE1_MS)
    );

    // Phase 2: friends
    pushTimer(
      window.setTimeout(() => {
        markDone(["friends"], "تم التحقق بنجاح ✅");
        setVerifyText("بانتظار شرط إنستغرام لإكمال التفعيل...");
        setVerifying(false);
        setVerifyPct(100);
        clearAllTimers(); // stop bar here; IG will continue
      }, PHASE1_MS + PHASE2_MS)
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ✅ IG click handler: open immediately, then 20s verify, then go unlocked
  function handleInstagramFollow() {
    if (igVerifying || finalizing) return;

    // open immediately
    window.open("https://instagram.com/flyalrafah", "_blank");

    // optimistic save (so page never "misses" IG)
     const phone = phoneRef.current || getPhone() || "";
     localStorage.setItem(IG_KEY(phone), "1");
     setIgDone(true);

    setIgVerifying(true);

    // mark IG "in progress"
    setSteps((prev) =>
      prev.map((s) =>
        s.id === "ig" ? { ...s, done: false, subtitle: "جارٍ التحقق... ⏳" } : s
      )
    );

    clearAllTimers();

    const start = Date.now();
    setVerifying(true);
    setVerifyText("جارٍ التحقق من شرط إنستغرام...");
    setVerifyPct(0);

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / PHASE3_MS) * 100));
      setVerifyPct(pct);
    }, 250);

    // after 20s: mark IG + done and redirect
    pushTimer(
      window.setTimeout(() => {
        markDone(["ig"], "تم التفعيل ✅");

        setIgVerifying(false);
        setFinalizing(true);

        setVerifyText("جارٍ إكمال التفعيل...");
        setVerifyPct(100);

        pushTimer(
          window.setTimeout(() => {
            markDone(["done"], "تم التفعيل ✅");
            router.replace("/unlocked");
          }, 900)
        );
      }, PHASE3_MS)
    );
  }

  // ✅ If sharePartDone & igDone (e.g., user had IG already), go finalize
  useEffect(() => {
    if (loading) return;
    if (!sharePartDone) return;
    if (!igDone) return;
    if (finalizing) return;

    setFinalizing(true);
    pushTimer(
      window.setTimeout(() => {
        markDone(["ig"], "تم التفعيل ✅");
        markDone(["done"], "تم التفعيل ✅");
        router.replace("/unlocked");
      }, 800)
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sharePartDone, igDone, finalizing, router]);

  const overallPercent = useMemo(() => {
    const doneCount = steps.filter((s) => s.done).length;
    const p = Math.round((doneCount / steps.length) * 100);
    return Math.max(0, Math.min(100, p));
  }, [steps]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6 bg-zinc-50"
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow">
          <div className="text-center">
            <div className="text-lg font-extrabold text-zinc-900">
              جارٍ التحميل...
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              نجهّز حالة التفعيل
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-purple-600" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen relative overflow-hidden p-6">
      {/* Background (landing vibe) */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-700 via-purple-500 to-yellow-400" />
      <div className="absolute inset-0 opacity-20 blur-3xl bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.20),transparent_50%)]" />

      {/* Decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-80px] top-[120px] h-[220px] w-[220px] rounded-full bg-white/10 blur-[1px]" />
        <div className="absolute right-[-90px] top-[220px] h-[260px] w-[260px] rounded-full bg-white/8 blur-[1px]" />
        <div className="absolute left-[40px] top-[420px] h-[140px] w-[140px] rounded-full bg-white/8 blur-[0.5px]" />
        <div className="absolute right-[70px] top-[520px] h-[120px] w-[120px] rounded-full bg-white/7 blur-[0.5px]" />
        <div className="absolute left-[120px] top-[95px] text-white/25 text-2xl">
          ✦
        </div>
        <div className="absolute right-[95px] top-[120px] text-white/20 text-xl">
          ✦
        </div>
        <div className="absolute right-[140px] top-[420px] text-white/20 text-2xl">
          ✦
        </div>
        <div className="absolute left-[70px] top-[560px] text-white/15 text-xl">
          ✦
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-white/25 bg-white/15 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.22)] overflow-hidden">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">مراحل التفعيل</h1>
            <p className="mt-1 text-sm text-white/85">
              أكمل الخطوات لتفعيل دخولك للقرعة
            </p>

            {/* Overall progress */}
            <div className="mt-4 rounded-2xl bg-black/10 border border-white/15 px-4 py-3 text-right">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/80">التقدّم</div>
                <div className="text-xs text-white/90 font-bold">
                  {overallPercent}%
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white/80 transition-all"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {/* ✅ 1-minute verification bar (split phases) */}
            {verifying && (
              <div className="mb-4 rounded-2xl border border-white/25 bg-white/10 px-4 py-4 text-right">
                <div className="font-extrabold text-white">{verifyText}</div>
                <div className="text-xs text-white/80 mt-1">
                  قد يستغرق التحقق حوالي دقيقة (مقسّمة على مراحل)
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-white/85">
                  <span>التقدّم</span>
                  <span className="font-bold">{verifyPct}%</span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/85 transition-all"
                    style={{ width: `${verifyPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3
                    ${
                      s.done
                        ? "border-emerald-200/60 bg-emerald-50/70"
                        : "border-white/25 bg-white/10"
                    }`}
                >
                  <div className="min-w-0 text-right">
                    <div
                      className={`${
                        s.done ? "text-zinc-900" : "text-white"
                      } font-extrabold`}
                    >
                      {s.title}
                    </div>
                    <div
                      className={`${
                        s.done ? "text-zinc-600" : "text-white/75"
                      } text-xs mt-1`}
                    >
                      {s.subtitle}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {s.done ? (
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                        ✅
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                        ⬜
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ IG block: show once share-part done OR (sharesCount >= REQUIRED_SHARES) */}
            {sharePartDone && !igDone && (
              <div className="mt-4 rounded-2xl border border-pink-200/60 bg-pink-50/70 px-4 py-4 text-right">
                <div className="font-extrabold text-zinc-900">شرط إنستغرام 📲</div>
                <div className="text-xs text-zinc-700/80 mt-1">
                </div>

                <button
                  onClick={handleInstagramFollow}
                  disabled={igVerifying || finalizing}
                  className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold shadow-[0_18px_55px_rgba(168,85,247,0.28)] disabled:opacity-70 active:scale-[0.99] transition"
                >
                  {igVerifying ? "جارٍ التحقق..." : "متابعة إنستغرام الآن"}
                </button>
              </div>
            )}

            {/* Finalizing hint */}
            {finalizing && (
              <div className="mt-4 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 px-4 py-4 text-right">
                <div className="font-extrabold text-zinc-900">
                  جارٍ إكمال التفعيل...
                </div>
                <div className="text-xs text-zinc-700/80 mt-1">
                  لحظات وننقلك لصفحة الكود
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
                </div>
              </div>
            )}

            {/* Footer mini stats */}
            <div className="mt-4 text-xs text-white/80 text-center">
              نقاطك: <span className="font-bold text-white">{points}</span>
              {" • "}
              المشاركات المحسوبة:{" "}
              <span className="font-bold text-white">{sharesCount}</span>
              {" • "}
              المطلوب:{" "}
              <span className="font-bold text-white">{REQUIRED_SHARES}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}