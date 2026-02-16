"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPhone } from "../lib/referral";

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

function pointsToOmr(points: number) {
  // 1 point = 0.001 OMR
  return (points * 0.001).toFixed(3);
}

export default function UnlockedPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refCode, setRefCode] = useState("XXXX");
  const [points, setPoints] = useState(0);
  const [joins, setJoins] = useState(0);

  const referralLink = useMemo(() => {
    return `https://flyalrafah.com/r/${refCode}`;
  }, [refCode]);

  const shareText = useMemo(() => {
    return `🎁 فرصة ربح 100 ريال (سحب شهري)
✈️ خصم على تذاكر السفر من FlyAlrafah

استخدم رابطّي للتسجيل:
${referralLink}

✅ كل مشاركة = 1 نقطة
👥 كل صديق يسجّل من رابطك = +10 نقاط`;
  }, [referralLink]);

  useEffect(() => {
    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);

        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
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
          {/* Header */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">🎉</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-zinc-900">
            تم تسجيلك في السحب الشهري ✅
          </h1>
          <p className="text-center text-zinc-500 mt-2">
            اسمك الآن ضمن قرعة FlyAlrafah الشهرية — ويمكنك جمع نقاط أكثر للحصول على خصومات.
          </p>

          {/* Code box */}
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">الكود الخاص بك</div>
            <div className="text-2xl font-extrabold tracking-widest text-zinc-900">{refCode}</div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => copy(refCode)}
                className="flex-1 rounded-xl py-3 bg-zinc-900 text-white font-bold hover:opacity-90"
              >
                نسخ الكود
              </button>
              <button
                onClick={() => copy(referralLink)}
                className="flex-1 rounded-xl py-3 bg-purple-100 text-purple-700 font-bold hover:bg-purple-200"
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
              <div className="text-xs text-zinc-500 mt-1">{pointsToOmr(points)} OMR</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 text-center">
              <div className="text-xs text-zinc-500">الأصدقاء المنضمّون</div>
              <div className="text-2xl font-bold text-zinc-900">{joins}</div>
              <div className="text-xs text-zinc-500 mt-1">(+10 نقاط لكل صديق)</div>
            </div>
          </div>

          {/* Rules box */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="font-bold text-zinc-900 mb-2">📌 قواعد النقاط</div>
            <ul className="text-sm text-zinc-700 space-y-2">
              <li>✅ كل مشاركة للرابط = <b>1 نقطة</b></li>
              <li>👥 كل صديق يسجّل من رابطك = <b>+10 نقاط</b></li>
              <li>🎁 كلما زادت نقاطك، زادت فرصك في الخصومات والسحب الشهري</li>
            </ul>
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
              window.open(url, "_blank");
            }}
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
          يمكنك الاستمرار في جمع النقاط عبر مشاركة الرابط ودعوة أصدقاء جدد.
        </p>
      </div>
    </main>
  );
}
