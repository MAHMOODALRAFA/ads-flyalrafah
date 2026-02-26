// app/share-progress/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REQUIRED_SHARES, hasAnsweredQuestions } from "../lib/referral";

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
      shareCooldown: {
        isBlocked: boolean;
        cooldownRemainingSec?: number;
        waitMinutes?: number;
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

const PHASE1_MS = 20_000;
const PHASE2_MS = 20_000;
const PHASE3_MS = 20_000;
const TOTAL_MS = PHASE1_MS + PHASE2_MS + PHASE3_MS;

export default function ShareProgressPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [points, setPoints] = useState<number>(0);
  const [joins, setJoins] = useState<number>(0);
  const [sharesCount, setSharesCount] = useState<number>(0);

  const [cooldownBlocked, setCooldownBlocked] = useState(false);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState<number>(0);

  const [igDone, setIgDone] = useState(false);
  const [phone, setPhone] = useState<string>("");

  const IG_KEY = useMemo(() => {
    return `flyalrafah_instagram_done__${phone || "unknown"}`;
  }, [phone]);

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
        ids.includes(s.id) ? { ...s, done: true, subtitle: subtitle ?? s.subtitle } : s
      )
    );
  }

  async function fetchCheck() {
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

    const p = Number(data.user.points || 0);
    const j = Number(data.user.joins || 0);
    const s = typeof data.user.sharesGiven === "number" ? Number(data.user.sharesGiven) : 0;

    setPhone(data.user.phone || "");
    setPoints(p);
    setJoins(j);
    setSharesCount(Math.max(0, s));

    const blocked = Boolean(data.shareCooldown?.isBlocked);
    setCooldownBlocked(blocked);

    const sec =
      data.shareCooldown?.cooldownRemainingSec ??
      (typeof data.shareCooldown?.waitMinutes === "number" ? data.shareCooldown.waitMinutes * 60 : 0);

    setCooldownRemainingSec(Math.max(0, Number(sec || 0)));

    return { points: p, joins: j, shares: Math.max(0, s), blocked, sec: Math.max(0, Number(sec || 0)) };
  }

  // ✅ Initial load (session-first)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const stats = await fetchCheck();
        if (cancelled) return;

        // ✅ questions gate (local UX)
        if (!hasAnsweredQuestions()) {
          router.replace("/questions");
          return;
        }

        // IG (per phone)
        const ig = phone ? localStorage.getItem(`flyalrafah_instagram_done__${phone}`) === "1" : false;
        setIgDone(ig);

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

  // Keep igDone synced when phone becomes available
  useEffect(() => {
    if (!phone) return;
    setIgDone(localStorage.getItem(IG_KEY) === "1");
  }, [phone, IG_KEY]);

  const sharePartDone = useMemo(() => {
    const ids: DemoStep["id"][] = ["q", "share", "wa", "friends"];
    return steps.filter((s) => ids.includes(s.id)).every((s) => s.done);
  }, [steps]);

  // ✅ verification animation after WA
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
      window.setTimeout(async () => {
        try {
          await fetchCheck();
        } catch {}
        markDone(["share", "wa"], "تم التحقق بنجاح ✅");
        setVerifyText("جارٍ التحقق من الإرسال للأصدقاء...");
      }, PHASE1_MS)
    );

    pushTimer(
      window.setTimeout(async () => {
        let latestShares = 0;
        try {
          const stats = await fetchCheck();
          latestShares = stats.shares;
        } catch {}

        if (latestShares >= REQUIRED_SHARES) {
          markDone(["friends"], "تم التحقق بنجاح ✅");
        } else {
          markDone(["friends"], "تحققنا — أكمل إرسال الرابط حتى يصل العدد المطلوب ✅");
        }

        setVerifyText("بانتظار شرط إنستغرام لإكمال التفعيل...");
        setVerifyPct(Math.round(((PHASE1_MS + PHASE2_MS) / TOTAL_MS) * 100));
        setVerifying(false);
        clearAllTimers();
      }, PHASE1_MS + PHASE2_MS)
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function handleInstagramFollow() {
    if (igVerifying || finalizing) return;

    window.open("https://instagram.com/flyalrafah", "_blank");

    setIgVerifying(true);
    setVerifying(true);
    setVerifyText("جارٍ التحقق من شرط إنستغرام...");
    setVerifyPct(Math.round(((PHASE1_MS + PHASE2_MS) / TOTAL_MS) * 100));

    setSteps((prev) =>
      prev.map((s) => (s.id === "ig" ? { ...s, done: false, subtitle: "جارٍ التحقق... ⏳" } : s))
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
        // ✅ per-user key
        localStorage.setItem(IG_KEY, "1");

        markDone(["ig"], "تم التفعيل ✅");
        setIgDone(true);

        setIgVerifying(false);
        setFinalizing(true);

        setVerifyText("جارٍ إكمال التفعيل...");
        setVerifyPct(100);

        pushTimer(
          window.setTimeout(() => {
            sessionStorage.setItem("entry_confirmed", "1");
            markDone(["done"], "تم التفعيل ✅");
            router.replace("/unlocked");
          }, 900)
        );
      }, PHASE3_MS)
    );
  }

  function handleShareAgain() {
    if (verifying || igVerifying || finalizing) return;
    sessionStorage.setItem("wa_pending_share", "1");
    router.push("/share");
  }

  useEffect(() => {
    if (loading) return;
    if (!sharePartDone) return;
    if (!igDone) return;
    if (finalizing) return;

    setFinalizing(true);
    pushTimer(
      window.setTimeout(() => {
        sessionStorage.setItem("entry_confirmed", "1");
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

  const needMoreShares = sharesCount < REQUIRED_SHARES;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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

          <h1 className="text-2xl font-extrabold text-center text-zinc-900">مراحل التفعيل</h1>
          <p className="text-center text-sm text-zinc-500 mt-2 mb-5">أكمل الخطوات لتفعيل دخولك للقرعة</p>

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

          {verifying && (
            <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">{verifyText}</div>

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

          <div className="space-y-3">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${
                  s.done ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"
                }`}
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

          {needMoreShares && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4">
              <div className="font-extrabold text-zinc-900">لم تكتمل المشاركات بعد</div>

              <div className="text-xs text-zinc-600 mt-1">
                المتبقي:{" "}
                <span className="font-bold text-zinc-900">{REQUIRED_SHARES - sharesCount}</span>{" "}
                مشاركات
                {cooldownBlocked && cooldownRemainingSec > 0 ? (
                  <>
                    {" — "}
                    انتظر{" "}
                    <span className="font-bold text-zinc-900">{cooldownRemainingSec}</span>{" "}
                    ثانية بسبب التوقيت
                  </>
                ) : null}
              </div>

              <button
                onClick={handleShareAgain}
                disabled={verifying || igVerifying || finalizing}
                className="w-full mt-3 py-3 rounded-2xl bg-zinc-900 text-white font-extrabold shadow-md disabled:opacity-60"
              >
                مشاركة الرابط مرة أخرى
              </button>

              {cooldownBlocked && cooldownRemainingSec > 0 && (
                <div className="text-xs text-zinc-500 mt-2">
                  تلميح: انتظر انتهاء العدّاد ثم اضغط مشاركة مرة أخرى.
                </div>
              )}
            </div>
          )}

          {sharePartDone && !igDone && (
            <div className="mt-4 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">شرط إنستغرام 📲</div>
              <div className="text-xs text-zinc-600 mt-1">اضغط للمتابعة، ثم سيتم التحقق خلال 20 ثانية</div>

              <button
                onClick={handleInstagramFollow}
                disabled={igVerifying || finalizing}
                className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold shadow-md disabled:opacity-70"
              >
                {igVerifying ? "جارٍ التحقق..." : "متابعة إنستغرام الآن"}
              </button>
            </div>
          )}

          {finalizing && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="font-extrabold text-zinc-900">جارٍ إكمال التفعيل...</div>
              <div className="text-xs text-zinc-600 mt-1">لحظات وننقلك لصفحة الكود</div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-600" />
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-zinc-500 text-center">
            نقاطك: <span className="font-bold text-zinc-900">{points}</span>
            {" • "}
            المشاركات: <span className="font-bold text-zinc-900">{sharesCount}</span>
            {" • "}
            المطلوب: <span className="font-bold text-zinc-900">{REQUIRED_SHARES}</span>
          </div>
        </div>
      </div>
    </main>
  );
}