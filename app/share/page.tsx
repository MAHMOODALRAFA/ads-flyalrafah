// app/share/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { REQUIRED_SHARES, hasAnsweredQuestions, setPhone } from "../lib/referral";
import { getAppOrigin } from "@/lib/origin";

type CheckOk = {
  ok: true;
  user: {
    phone?: string;
    refCode: string;
    points: number;
    sharesGiven?: number;
  };
  shareCooldown: {
    isBlocked: boolean;
    cooldownRemainingSec?: number;
    waitMinutes?: number;
  };
};

type CheckResponse = CheckOk | { ok: false; error: string };

type ShareOk = {
  ok: true;
  credited: boolean;
  addedPoints?: number;
  creditMode?: "first_share" | "normal" | "cooldown";
  cooldownRemainingSec?: number;
  waitMinutes?: number;
  user?: { refCode?: string; points?: number; sharesGiven?: number; phone?: string };
};

type ShareResponse = ShareOk | { ok: false; error: string };

export default function SharePage() {
  const router = useRouter();

  const [refCode, setRefCodeState] = useState<string>("XXXX");
  const [points, setPoints] = useState<number>(0);
  const [sharesGiven, setSharesGiven] = useState<number>(0);

  const [cooldownBlocked, setCooldownBlocked] = useState<boolean>(false);
  const [cooldownSec, setCooldownSec] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const origin = useMemo(() => getAppOrigin().replace(/\/+$/, ""), []);
  const referralLink = useMemo(() => `${origin}/r/${refCode || "XXXX"}`, [origin, refCode]);

  const messageTemplate = useMemo(() => {
    return `🎁 فرصة قرعة شهرية من FlyAlrafah
{LINK}

✅ شارك الرابط مع ${REQUIRED_SHARES} من أصدقائك عبر واتساب
⭐ كل مشاركة = نقاط أكثر + فرصة أكبر للفوز
🔹 مسقط – شيراز
🔹 مسقط – الأهواز
🔹 مسقط – شابهار
🔹 مسقط – مشهد
🔹 مسقط – طهران
💰 ابتداءً من 29 ريال
📲 للحجز والاستفسار عبر الواتساب:
https://wa.me/96872680912

🌐 Flyalrafah.com`;
  }, []);

  const shareText = useMemo(() => messageTemplate.replace("{LINK}", referralLink), [messageTemplate, referralLink]);

  // ✅ Session-first guard
  useEffect(() => {
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

        // optional: sync local phone marker
        if (data.user.phone) setPhone(data.user.phone);

        // ✅ questions gate (local UX)
        if (!hasAnsweredQuestions()) {
          router.replace("/questions");
          return;
        }

        setRefCodeState(data.user.refCode || "XXXX");
        setPoints(Number(data.user.points || 0));
        setSharesGiven(typeof data.user.sharesGiven === "number" ? data.user.sharesGiven : 0);

        const blocked = !!data.shareCooldown?.isBlocked;
        setCooldownBlocked(blocked);

        const sec =
          data.shareCooldown?.cooldownRemainingSec ??
          (typeof data.shareCooldown?.waitMinutes === "number" ? data.shareCooldown.waitMinutes * 60 : 0);

        setCooldownSec(sec);
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

  async function shareToWhatsApp() {
    if (submitting) return;

    try {
      setSubmitting(true);

      // ✅ always open WhatsApp (low friction)
      sessionStorage.setItem("wa_pending_share", "1");
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");

      // ✅ credit share (server decides cooldown)
      const res = await fetch("/api/share", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json().catch(() => null)) as ShareResponse | null;

      if (res.ok && data && data.ok !== false) {
        if (typeof data.user?.points === "number") setPoints(data.user.points);
        if (typeof data.user?.sharesGiven === "number") setSharesGiven(data.user.sharesGiven);

        const sec =
          data.cooldownRemainingSec ??
          (typeof data.waitMinutes === "number" ? data.waitMinutes * 60 : 60);

        setCooldownBlocked(true);
        setCooldownSec(sec);
      }

      router.push("/share-progress");
    } catch {
      router.push("/share-progress");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-bold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نجهّز رابطك الخاص</div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            خطوة 3 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-zinc-900">تم إنشاء رابطك الخاص</h1>
          <p className="text-center text-zinc-500 mt-2 mb-3">
            شارك الرابط مع {REQUIRED_SHARES} أصدقاء لزيادة نقاطك وفرصتك في القرعة 🎯
          </p>

          <div className="flex items-center justify-between text-sm text-zinc-600 mb-4">
            <div>
              نقاطك: <span className="font-bold text-zinc-900">{points}</span>
            </div>
            <div>
              المشاركات: <span className="font-bold text-zinc-900">{sharesGiven}</span>
            </div>
          </div>

          {cooldownBlocked && cooldownSec > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-zinc-700">
              ⏳ يمكنك الحصول على نقطة جديدة بعد حوالي <b>{cooldownSec}</b> ثانية.
            </div>
          ) : null}

          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 mb-5">
            <div className="text-xs text-zinc-500 mb-2">معاينة الرسالة:</div>
            <pre className="whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed">{shareText}</pre>
          </div>

          <button
            onClick={shareToWhatsApp}
            disabled={submitting}
            className="w-full rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "جارٍ فتح واتساب..." : "مشاركة عبر واتساب"} <span>🔗</span>
          </button>

          <button
            onClick={() => router.push("/status")}
            className="w-full mt-3 rounded-2xl py-4 text-white font-extrabold shadow-md transition bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 hover:opacity-95"
          >
            عرض النقاط 🎯
          </button>

          <button
            onClick={() => router.push("/share-progress")}
            className="w-full mt-4 text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-4"
          >
            متابعة
          </button>
        </div>
      </div>
    </main>
  );
}