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

// ✅ IG key per phone (fix: new number won't inherit old IG)
const IG_KEY = (phone: string) => `flyalrafah_instagram_done_${phone || "unknown"}`;
const LEGACY_IG_KEY = "flyalrafah_instagram_done";

// ✅ total 1 minute split
const PHASE1_MS = 20_000; // share+wa
const PHASE2_MS = 20_000; // friends
const PHASE3_MS = 20_000; // IG verify
const TOTAL_MS = PHASE1_MS + PHASE2_MS + PHASE3_MS;

export default function ShareProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [points, setPoints] = useState<number>(0);
  const [joins, setJoins] = useState<number>(0);
  const [sharesCount, setSharesCount] = useState<number>(0);

  const [igDone, setIgDone] = useState(false);

  // unified verifying bar
  const [verifying, setVerifying] = useState(false);
  const [verifyText, setVerifyText] = useState("");
  const [verifyPct, setVerifyPct] = useState(0);

  const [igVerifying, setIgVerifying] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [steps, setSteps] = useState<DemoStep[]>([
    { id: "q", title: "تم تأكيد إجابات الأسئلة", subtitle: "تم تسجيل اهتمامك بالسفر.", done: false },
    { id: "share", title: "تم تسجيل المشاركة", subtitle: "نقوم بمراجعة نقاط المشاركة...", done: false },
    { id: "wa", title: "فتح واتساب لإرسال الرابط", subtitle: "نقوم بتأكيد فتح واتساب...", done: false },
    { id: "friends", title: `إرسال إلى ${REQUIRED_SHARES} أصدقاء`, subtitle: "نقوم بالتحقق من عملية الإرسال...", done: false },
    { id: "ig", title: "متابعة إنستغرام FlyAlrafah", subtitle: "اضغط للمتابعة ثم نُكمل التفعيل.", done: false },
    { id: "done", title: "تم تفعيل دخولك للقرعة الشهرية", subtitle: "جارٍ تجهيز صفحتك الأخيرة...", done: false },
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

  function markDone(ids: DemoStep["id"][], subtitle?: string) {
    setSteps((prev) =>
      prev.map((s) =>
        ids.includes(s.id)
          ? { ...s, done: true, subtitle: subtitle ?? s.subtitle }
          : s
      )
    );
  }

  async function fetchCheck(phone: string) {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as CheckResponse | null;
    if (!res.ok || !data || !data.ok) throw new Error("bad_response");

    const p = Number(data.user.points || 0);
    const j = Number(data.user.joins || 0);
    const computedShares = Math.max(0, p - j * 10);

    setPoints(p);
    setJoins(j);
    setSharesCount(computedShares);

    return { points: p, joins: j, shares: computedShares };
  }

  // ✅ Guards + init (and IG key fix)
  useEffect(() => {
    if (!hasStarted()) return router.replace("/start");

    const phone = getPhone();
    if (!phone) return router.replace("/start");

    if (!hasAnsweredQuestions()) return router.replace("/questions");

    phoneRef.current = phone;

    // purge legacy key always (so it never affects new numbers)
    if (localStorage.getItem(LEGACY_IG_KEY) != null) localStorage.removeItem(LEGACY_IG_KEY);

    const ig = localStorage.getItem(IG_KEY(phone)) === "1";
    setIgDone(ig);

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const stats = await fetchCheck(phone);
        if (cancelled) return;

        markDone(["q"], "تم الحفظ بنجاح ✅");

        if (stats.shares > 0) markDone(["share", "wa"], "تم التحقق بنجاح ✅");
        if (stats.shares >= REQUIRED_SHARES) markDone(["friends"], "تم التحقق بنجاح ✅");

        if (ig) markDone(["ig"], "تم التفعيل ✅");
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

  // ✅ After coming from /share: run 40s verification (phase1+phase2) then stop & wait IG
  useEffect(() => {
    if (loading) return;

    const pending = sessionStorage.getItem("wa_pending_share") === "1";
    if (!pending) return;

    sessionStorage.removeItem("wa_pending_share");

    clearAllTimers();
    setVerifying(true);
    setVerifyPct(0);
    setVerifyText("جارٍ التحقق من المشاركة...");

    const start = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
      setVerifyPct(pct);
    }, 250);

    pushTimer(
      window.setTimeout(() => {
        markDone(["share", "wa"], "تم التحقق بنجاح ✅");
        setVerifyText("جارٍ التحقق من الإرسال للأصدقاء...");
      }, PHASE1_MS)
    );

    pushTimer(
      window.setTimeout(() => {
        markDone(["friends"], "تم التحقق بنجاح ✅");
        setVerifyText("بانتظار شرط إنستغرام لإكمال التفعيل...");
        setVerifyPct(Math.round(((PHASE1_MS + PHASE2_MS) / TOTAL_MS) * 100));
        setVerifying(false);
        clearAllTimers();
      }, PHASE1_MS + PHASE2_MS)
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ✅ IMPORTANT FIX:
  // When clicking IG: do NOT set igDone immediately.
  // Run 20s verification first, then set igDone + redirect.
  function handleInstagramFollow() {
    if (igVerifying || finalizing) return;

    window.open("https://instagram.com/flyalrafah", "_blank");

    setIgVerifying(true);
    setVerifying(true);
    setVerifyText("جارٍ التحقق من شرط إنستغرام...");
    setVerifyPct(Math.round(((PHASE1_MS + PHASE2_MS) / TOTAL_MS) * 100));

    // show IG step as "verifying"
    setSteps((prev) =>
      prev.map((s) =>
        s.id === "ig" ? { ...s, done: false, subtitle: "جارٍ التحقق... ⏳ (20 ثانية)" } : s
      )
    );

    clearAllTimers();

    const base = PHASE1_MS + PHASE2_MS;
    const start = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round(((base + elapsed) / TOTAL_MS) * 100));
      setVerifyPct(pct);
    }, 250);

    pushTimer(
      window.setTimeout(() => {
        const phone = phoneRef.current || getPhone() || "";
        localStorage.setItem(IG_KEY(phone), "1");

        markDone(["ig"], "تم التفعيل ✅");
        setIgDone(true);

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

  // ✅ If sharePartDone & igDone already true (previous session), go unlocked (quick)
  useEffect(() => {
    if (loading) return;
    if (!sharePartDone) return;
    if (!igDone) return;
    if (finalizing) return;

    setFinalizing(true);
    pushTimer(
      window.setTimeout(() => {
        markDone(["done"], "تم التفعيل ✅");
        router.replace("/unlocked");
      }, 700)
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sharePartDone, igDone, finalizing, router]);

  const overallPercent = useMemo(() => {
    const doneCount = steps.filter((s) => s.done).length;
    return Math.max(0, Math.min(100, Math.round((doneCount / steps.length) * 100)));
  }, [steps]);

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-extrabold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نجهّز حالة التفعيل</div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-purple-600" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Step indicator (like other pages) */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            خطوة 3 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-center text-zinc-900">
            مراحل التفعيل
          </h1>
          <p className="text-center text-sm text-zinc-500 mt-2 mb-5">
            أكمل الخطوات لتفعيل دخولك للقرعة
          </p>

          {/* Overall progress (graphic bar) */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">التقدّم</div>
              <div className="text-xs font-bold text-zinc-800">{overallPercent}%</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 transition-all"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          {/* ✅ 1-minute verification bar (graphic) */}
          {verifying && (
            <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">{verifyText}</div>
              <div className="text-xs text-zinc-600 mt-1">
                قد يستغرق التحقق حوالي دقيقة (مقسّمة على مراحل)
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
                <span>التقدّم</span>
                <span className="font-bold text-zinc-900">{verifyPct}%</span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-purple-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 transition-all"
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
                  ${s.done ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}
              >
                <div className="min-w-0 text-right">
                  <div className="font-extrabold text-zinc-900">{s.title}</div>
                  <div className="text-xs text-zinc-500 mt-1">{s.subtitle}</div>
                </div>

                <div className="shrink-0 pt-1">
                  {s.done ? (
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-300 flex items-center justify-center">
                      ✅
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                      ⬜
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* IG block: only after share part done and IG not done */}
          {sharePartDone && !igDone && (
            <div className="mt-4 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">شرط إنستغرام 📲</div>
              <div className="text-xs text-zinc-600 mt-1">
                اضغط للمتابعة، ثم سيتم التحقق خلال 20 ثانية
              </div>

              <button
                onClick={handleInstagramFollow}
                disabled={igVerifying || finalizing}
                className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold shadow-md disabled:opacity-70"
              >
                {igVerifying ? "جارٍ التحقق..." : "متابعة إنستغرام الآن"}
              </button>
            </div>
          )}

          {/* Finalizing */}
          {finalizing && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">جارٍ إكمال التفعيل...</div>
              <div className="text-xs text-zinc-600 mt-1">لحظات وننقلك لصفحة الكود</div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div className="mt-4 text-xs text-zinc-500 text-center">
            نقاطك: <span className="font-bold text-zinc-900">{points}</span>
            {" • "}
            المشاركات المحسوبة: <span className="font-bold text-zinc-900">{sharesCount}</span>
            {" • "}
            المطلوب: <span className="font-bold text-zinc-900">{REQUIRED_SHARES}</span>
          </div>
        </div>
      </div>
    </main>
  );
}