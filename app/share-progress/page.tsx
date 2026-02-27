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

export default function ShareProgressPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [pct, setPct] = useState(0);

  const [phone, setPhone] = useState("");
  const [sharesGiven, setSharesGiven] = useState(0);
  const [igDone, setIgDone] = useState(false);

  const timersRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);

  const IG_KEY = useMemo(() => `flyalrafah_instagram_done__${phone || "unknown"}`, [phone]);

  function clearAllTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function startProgress(durationMs: number, fromPct: number, toPct: number) {
    clearAllTimers();
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

        // local UX gate
        if (!hasAnsweredQuestions()) {
          router.replace("/questions");
          return;
        }

        const stats = await fetchCheck();
        if (cancelled) return;

        const ig = stats.phone
          ? localStorage.getItem(`flyalrafah_instagram_done__${stats.phone}`) === "1"
          : false;
        setIgDone(ig);

        // ✅ must have at least 1 share recorded in system
        if (stats.shares < 1) {
          setStage("need_share");
          setPct(10);
          return;
        }

        // ✅ When user comes from WA share button, run the 40s verification
        const pending = sessionStorage.getItem("wa_pending_share") === "1";
        if (pending) sessionStorage.removeItem("wa_pending_share");

        // Even if not pending, we can still show need_ig directly (since share is done)
        if (!pending) {
          setStage(ig ? "finalizing" : "need_ig");
          setPct(ig ? 85 : 70);

          if (ig) {
            startProgress(FINALIZE_MS, 85, 100);
            timersRef.current.push(
              window.setTimeout(() => {
                sessionStorage.setItem("entry_confirmed", "1");
                router.replace("/unlocked");
              }, FINALIZE_MS)
            );
          }

          return;
        }

        setStage("verifying_share");
        startProgress(VERIFY_SHARE_MS, 10, 70);

        timersRef.current.push(
          window.setTimeout(async () => {
            try {
              const fresh = await fetchCheck();
              // if somehow share count dropped (shouldn't), fallback
              if (fresh.shares < 1) {
                setStage("need_share");
                setPct(10);
                return;
              }
            } catch {
              // ignore; keep flow
            }

            // after 40s go to IG step
            const ig2 = stats.phone
              ? localStorage.getItem(`flyalrafah_instagram_done__${stats.phone}`) === "1"
              : false;
            setIgDone(ig2);

            if (ig2) {
              setStage("finalizing");
              startProgress(FINALIZE_MS, 70, 100);
              timersRef.current.push(
                window.setTimeout(() => {
                  sessionStorage.setItem("entry_confirmed", "1");
                  router.replace("/unlocked");
                }, FINALIZE_MS)
              );
            } else {
              setStage("need_ig");
              setPct(70);
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

  function handleGoShare() {
    sessionStorage.setItem("wa_pending_share", "1");
    router.push("/share");
  }

  function handleInstagramFollow() {
    if (!phone) return;

    // open IG
    window.open("https://instagram.com/flyalrafah", "_blank");

    // mark locally
    localStorage.setItem(IG_KEY, "1");
    setIgDone(true);

    // finalize
    setStage("finalizing");
    startProgress(FINALIZE_MS, 70, 100);

    timersRef.current.push(
      window.setTimeout(() => {
        sessionStorage.setItem("entry_confirmed", "1");
        router.replace("/unlocked");
      }, FINALIZE_MS)
    );
  }

  const title = useMemo(() => {
    if (stage === "loading") return "جارٍ التحميل...";
    if (stage === "need_share") return "مشاركة واحدة مطلوبة أولاً";
    if (stage === "verifying_share") return "جارٍ التحقق من الإرسال إلى 5 أصدقاء";
    if (stage === "need_ig") return "شرط إنستغرام 📲";
    return "جارٍ إكمال التفعيل...";
  }, [stage]);

  const subtitle = useMemo(() => {
    if (stage === "need_share")
      return "اضغط مشاركة الرابط مرة واحدة عبر واتساب ثم ارجع هنا لإكمال التفعيل.";
    if (stage === "verifying_share")
      return "نقوم بمراجعة عملية الإرسال (فقط للتأكد) — انتظر قليلاً.";
    if (stage === "need_ig")
      return "اضغط للمتابعة على إنستغرام لإكمال التفعيل ثم سننقلك لصفحة الكود.";
    if (stage === "finalizing") return "لحظات وننقلك لصفحة الكود ✅";
    return "نجهّز حالة التفعيل";
  }, [stage]);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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
              className="w-full mt-2 py-3 rounded-2xl bg-zinc-900 text-white font-extrabold shadow-md"
            >
              مشاركة الرابط عبر واتساب
            </button>
          )}

          {stage === "need_ig" && (
            <button
              onClick={handleInstagramFollow}
              className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold shadow-md"
            >
              متابعة إنستغرام الآن
            </button>
          )}

          {/* Small debug-ish footer (kept minimal) */}
          <div className="mt-4 text-xs text-zinc-500 text-center">
            المشاركات المسجلة: <span className="font-bold text-zinc-900">{sharesGiven}</span>
            {" • "}
            إنستغرام: <span className="font-bold text-zinc-900">{igDone ? "✅" : "—"}</span>
          </div>
        </div>
      </div>
    </main>
  );
}