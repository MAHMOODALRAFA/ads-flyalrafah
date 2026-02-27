// app/unlocked/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAnsweredQuestions, REQUIRED_SHARES } from "../lib/referral";

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
    }
  | { ok: false; error: string };

type ShareResponse =
  | {
      ok: true;
      credited: boolean;
      creditMode?: "first_share" | "normal" | "cooldown";
      addedPoints?: number;
      cooldownRemainingSec?: number;
      waitMinutes?: number;
      user?: { points?: number; sharesGiven?: number };
    }
  | { ok: false; error: string };

export default function UnlockedPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refCode, setRefCode] = useState("XXXX");
  const [points, setPoints] = useState(0);
  const [joins, setJoins] = useState(0);
  const [sharesGiven, setSharesGiven] = useState(0);

  const [highlightEntry, setHighlightEntry] = useState(false);
  const [sharing, setSharing] = useState(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "https://ads-flyalrafah.vercel.app";
    return window.location.origin;
  }, []);

  const referralLink = useMemo(() => `${origin}/r/${refCode}`, [origin, refCode]);

  const shareText = useMemo(() => {
    return `🎉 تم تسجيلك في قرعة FlyAlrafah الشهرية!

استخدم رابطّي للتسجيل:
${referralLink}

✅ كل مشاركة = 1 نقطة (مع توقيت بسيط)
👥 كل صديق يسجّل من رابطك = +10 نقاط

⭐ نقاط أكثر = فرصة أكبر للفوز`;
  }, [referralLink]);

  useEffect(() => {
    // local UX gate only
    if (!hasAnsweredQuestions()) {
      router.replace("/questions");
      return;
    }

    const entryConfirmed = sessionStorage.getItem("entry_confirmed") === "1";
    if (entryConfirmed) {
      setHighlightEntry(true);
      sessionStorage.removeItem("entry_confirmed");
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);

        const res = await fetch("/api/check", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const data = (await res.json().catch(() => null)) as CheckResponse | null;
        if (cancelled) return;

        if (!res.ok || !data || data.ok === false) {
          router.replace("/start");
          return;
        }

        // ✅ NO redirect back here anymore
        setRefCode(data.user.refCode || "XXXX");
        setPoints(Number(data.user.points || 0));
        setJoins(Number(data.user.joins || 0));
        setSharesGiven(Number(data.user.sharesGiven ?? 0) || 0);
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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("تم النسخ ✅");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("تم النسخ ✅");
    }
  }

  async function shareAgain() {
    if (sharing) return;

    try {
      setSharing(true);

      // credit share (server decides cooldown)
      const res = await fetch("/api/share", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json().catch(() => null)) as ShareResponse | null;

      if (res.ok && data && data.ok) {
        if (typeof data.user?.points === "number") setPoints(data.user.points);
        if (typeof data.user?.sharesGiven === "number") setSharesGiven(data.user.sharesGiven);
      }

      sessionStorage.setItem("wa_pending_share", "1");
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } catch {
      sessionStorage.setItem("wa_pending_share", "1");
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-bold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نجهّز بياناتك</div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-center mb-4">
            <div
              className={[
                "h-16 w-16 rounded-full flex items-center justify-center",
                highlightEntry ? "bg-gradient-to-br from-purple-600 to-amber-400" : "bg-green-100",
              ].join(" ")}
            >
              <span className="text-3xl">{highlightEntry ? "🏆" : "🎉"}</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-zinc-900">تم تسجيلك في القرعة الشهرية ✅</h1>

          <p className="text-center text-zinc-600 mt-2">
            {highlightEntry
              ? "مبروك! تم تأكيد دخولك للقرعة — استمر بالمشاركة لرفع فرصتك 🔥"
              : "اسمك الآن ضمن قرعة FlyAlrafah الشهرية — وكلما زادت نقاطك زادت فرصتك 🎯"}
          </p>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">الكود الخاص بك</div>
            <div className="text-2xl font-extrabold tracking-widest text-zinc-900">{refCode}</div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => copy(refCode)}
                className="rounded-xl py-3 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
              >
                نسخ الكود
              </button>
              <button
                onClick={() => copy(referralLink)}
                className="rounded-xl py-3 bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition"
              >
                نسخ الرابط
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">نقاطك</div>
              <div className="text-2xl font-bold text-zinc-900">{points}</div>
              <div className="text-xs text-zinc-500 mt-1">كل نقطة تزيد فرصتك</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">المشاركات</div>
              <div className="text-2xl font-bold text-zinc-900">{sharesGiven}</div>
              <div className="text-xs text-zinc-500 mt-1">كل مشاركة = 1 نقطة</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">الأصدقاء المنضمّون</div>
              <div className="text-2xl font-bold text-zinc-900">{joins}</div>
              <div className="text-xs text-zinc-500 mt-1">(+10 لكل صديق)</div>
            </div>
          </div>

          <button
            onClick={shareAgain}
            disabled={sharing}
            className="w-full mt-5 rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition disabled:opacity-60"
          >
            {sharing ? "جارٍ تسجيل المشاركة..." : "مشاركة الرابط مرة أخرى عبر واتساب 🔗"}
          </button>

          <button
            onClick={() => router.push("/share")}
            className="w-full mt-3 rounded-2xl py-4 bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition"
          >
            رجوع لصفحة المشاركة
          </button>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-4">
          استمر بالمشاركة — نقاط أكثر = فرصة أكبر للفوز 🎯
        </p>
      </div>
    </main>
  );
}