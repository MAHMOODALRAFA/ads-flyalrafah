"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPhone } from "../lib/referral";

type MeResponse =
  | { ok: true; user: { phone: string; refCode: string; points: number } }
  | { ok: false; error: string };

type ShareResponse =
  | {
      ok: true;
      credited: boolean;
      addedPoints?: number;
      reason?: "cooldown";
      waitMinutes?: number;
      user?: { phone: string; refCode: string; points: number; lastShareAt?: string | null };
    }
  | { ok: false; error: string };

export default function SharePage() {
  const router = useRouter();

  const [refCode, setRefCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "https://flyalrafah.com";
    return window.location.origin;
  }, []);

  // ✅ Link: نفس الدومين (local/dev/production)
  const referralLink = useMemo(() => {
    return `${origin}/r/${refCode || "XXXX"}`;
  }, [origin, refCode]);

  // ✅ 템پلیت ثابت
const messageTemplate = useMemo(() => {
  return `🎁 خصم تذاكر سفر / هدايا

{LINK}

✈️ طيران قشم إير

مسقط ⇄ طهران

🎯 25 فبراير : 40﷼  
🎯 30 فبراير : 30﷼

🥏 للحجز والاستفسار عبر الواتساب:
https://wa.me/96872680912

🌐 الحجز أونلاين:
Flyalrafah.com`;
}, []);

  const shareText = useMemo(() => {
    return messageTemplate.replace("{LINK}", referralLink);
  }, [messageTemplate, referralLink]);

  // ✅ Load refCode from DB
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
        const res = await fetch(`/api/me?phone=${encodeURIComponent(phone)}`);
        const data = (await res.json().catch(() => null)) as MeResponse | null;

        if (cancelled) return;

        if (!res.ok || !data || !data.ok || !data.user?.refCode) {
          router.replace("/start");
          return;
        }

        setRefCode(data.user.refCode);
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

    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    try {
      setSubmitting(true);

      // ✅ 1) increment points in DB
      const res = await fetch("/api/referral/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = (await res.json().catch(() => null)) as ShareResponse | null;

      if (!res.ok || !data) {
        alert("حصل خطأ أثناء تسجيل المشاركة، حاول مرة أخرى");
        return;
      }

      if (!data.ok) {
        alert("حصل خطأ أثناء تسجيل المشاركة، حاول مرة أخرى");
        return;
      }

      // ✅ cooldown
      if (data.credited === false && data.reason === "cooldown") {
        const m = data.waitMinutes ?? 1;
        alert(`تم تسجيل المشاركة ✅ لكن انتظر ${m} دقيقة قبل إضافة نقطة جديدة`);
      }

      // ✅ 2) open WhatsApp
      const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(url, "_blank");

      // ✅ 3) go progress
      router.push("/share-progress");
    } catch {
      alert("تعذر الاتصال بالخادم، حاول مرة أخرى");
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
        {/* Step indicator */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            خطوة 2 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-zinc-900">تم إنشاء رابطك الخاص</h1>
          <p className="text-center text-zinc-500 mt-2 mb-5">أرسل الرابط إلى 5 أصدقاء</p>

          {/* Message preview (keep for WhatsApp share only) */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 mb-5">
            <div className="text-xs text-zinc-500 mb-2">معاينة الرسالة:</div>
            <pre className="whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed">{shareText}</pre>
          </div>

          {/* Buttons */}
          <button
            onClick={shareToWhatsApp}
            disabled={submitting}
            className="w-full rounded-2xl py-4 bg-green-500 text-white font-bold shadow-md hover:bg-green-600 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "جارٍ تسجيل المشاركة..." : "مشاركة عبر واتساب"} <span>🔗</span>
          </button>

          <button
            onClick={() => router.push("/check")}
            className="w-full mt-3 rounded-2xl py-4 text-white font-extrabold shadow-md transition
                       bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-400 hover:opacity-95"
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
