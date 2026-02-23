"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPhone, hasAnsweredQuestions, hasStarted } from "../lib/referral";

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
    }
  | { ok: false; error: string };

export default function UnlockedPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refCode, setRefCode] = useState("XXXX");
  const [points, setPoints] = useState(0);
  const [joins, setJoins] = useState(0);

  const [highlightEntry, setHighlightEntry] = useState(false);

  const referralLink = useMemo(() => {
    return `https://flyalrafah.com/r/${refCode}`;
  }, [refCode]);

  const shareText = useMemo(() => {
    return `🎉 تم تسجيلك في قرعة FlyAlrafah الشهرية!

استخدم رابطّي للتسجيل:
${referralLink}

✅ كل مشاركة = 1 نقطة
👥 كل صديق يسجّل من رابطك = +10 نقاط

⭐ نقاط أكثر = فرصة أكبر للفوز`;
  }, [referralLink]);

  useEffect(() => {
    // ✅ Guard: must have started + phone
    if (!hasStarted()) {
      router.replace("/start");
      return;
    }

    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    // ✅ Must answer questions first
    if (!hasAnsweredQuestions()) {
      router.replace("/questions");
      return;
    }

    // ✅ Special highlight if we came from demo progress finish
    const entryConfirmed = sessionStorage.getItem("entry_confirmed") === "1";
    if (entryConfirmed) {
      setHighlightEntry(true);
      // cleanup so it won't show every time
      sessionStorage.removeItem("entry_confirmed");
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);

        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
          cache: "no-store",
        });

        const data = (await res.json().catch(() => null)) as CheckResponse | null;

        if (cancelled) return;

        if (!res.ok || !data || !data.ok) {
          router.replace("/start");
          return;
        }

        setRefCode(data.user.refCode || "XXXX");
        setPoints(Number(data.user.points || 0));
        setJoins(Number(data.user.joins || 0));
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

  function shareAgain() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-zinc-50 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-bold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نجهّز بياناتك</div>
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
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Header */}
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

          <h1 className="text-2xl font-bold text-center text-zinc-900">
            تم تسجيلك في القرعة الشهرية ✅
          </h1>

          <p className="text-center text-zinc-600 mt-2">
            {highlightEntry
              ? "مبروك! تم تأكيد دخولك للقرعة — استمر بالمشاركة لرفع فرصتك 🔥"
              : "اسمك الآن ضمن قرعة FlyAlrafah الشهرية — وكلما زادت نقاطك زادت فرصتك 🎯"}
          </p>

          {/* Badge Row */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
              🎟️ قرعة شهرية
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
              ⭐ نقاط أكثر = فرصة أكبر
            </span>
          </div>

          {/* Code box */}
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">الكود الخاص بك</div>
            <div className="text-2xl font-extrabold tracking-widest text-zinc-900">
              {refCode}
            </div>

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

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">نقاطك</div>
              <div className="text-2xl font-bold text-zinc-900">{points}</div>
              <div className="text-xs text-zinc-500 mt-1">كل نقطة تزيد فرصتك</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">الأصدقاء المنضمّون</div>
              <div className="text-2xl font-bold text-zinc-900">{joins}</div>
              <div className="text-xs text-zinc-500 mt-1">(+10 نقاط لكل صديق)</div>
            </div>
          </div>

          {/* Rules box */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="font-bold text-zinc-900 mb-2">📌 كيف تزيد فرصتك؟</div>
            <ul className="text-sm text-zinc-700 space-y-2">
              <li>✅ كل مشاركة للرابط = <b>1 نقطة</b></li>
              <li>👥 كل صديق يسجّل من رابطك = <b>+10 نقاط</b></li>
              <li>🏆 <b>نقاط أكثر</b> تعني <b>فرصة أكبر</b> للفوز في القرعة الشهرية</li>
            </ul>
          </div>

          {/* CTA */}
          <button
            onClick={shareAgain}
            className="w-full mt-5 rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition"
          >
            مشاركة الرابط مرة أخرى عبر واتساب 🔗
          </button>

          <button
            onClick={() => router.push("/share")}
            className="w-full mt-3 rounded-2xl py-4 bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 transition"
          >
            رجوع لصفحة المشاركة
          </button>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-4">
          استمر بمشاركة الرابط — نقاط أكثر = فرصة أكبر للفوز 🎯
        </p>
      </div>
    </main>
  );
}
