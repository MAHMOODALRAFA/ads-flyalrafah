// app/start/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAnsweredQuestions, setPhone } from "../lib/referral";

type Destination = { value: string; label: string };

type CheckResponse =
  | {
      ok: true;
      user: {
        phone: string;
        refCode: string;
        points: number;
        sharesGiven?: number;
      };
      shareCooldown?: {
        isBlocked: boolean;
        cooldownRemainingSec?: number;
        waitMinutes?: number;
      };
    }
  | { ok: false; error: string };

export default function StartPage() {
  const router = useRouter();

  const destinations: Destination[] = useMemo(
    () => [
      { value: "shiraz", label: "شيراز" },
      { value: "tehran", label: "طهران" },
      { value: "mashhad", label: "مشهد" },
      { value: "chabahar", label: "جابهار" },
      { value: "kish", label: "جزيرة كيش" },
      { value: "bandar-abbas", label: "بندر عباس" },
      { value: "ahvaz", label: "الأهواز" },
    ],
    []
  );

  const [destination, setDestination] = useState(destinations[0]?.value ?? "");
  const OMAN_PREFIX = "+968";
  const [whatsappLocal, setWhatsappLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ Session-first guard (source of truth)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const data = (await res.json().catch(() => null)) as CheckResponse | null;
        if (cancelled) return;

        // If session exists => route forward
        if (res.ok && data && data.ok) {
          // sync local phone guard (optional)
          if (data.user?.phone) setPhone(data.user.phone);

          if (hasAnsweredQuestions()) {
            router.replace("/share");
          } else {
            router.replace("/questions");
          }
        }
        // else: no session => stay on start form
      } catch {
        // ignore network errors here; stay on start form
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function normalizeDigits(input: string) {
    const map: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
      "۰": "0",
      "۱": "1",
      "۲": "2",
      "۳": "3",
      "۴": "4",
      "۵": "5",
      "۶": "6",
      "۷": "7",
      "۸": "8",
      "۹": "9",
    };
    return (input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  }

  function cleanLocalDigits(input: string) {
    return normalizeDigits(input).replace(/[^\d]/g, "");
  }

  function isValidOmanWhatsapp(localDigits: string) {
    const x = cleanLocalDigits(localDigits);
    return x.length === 8;
  }

  async function handleNext() {
    if (submitting) return;

    if (!whatsappLocal || !isValidOmanWhatsapp(whatsappLocal)) {
      alert("الرجاء إدخال رقم واتساب عماني صحيح (8 أرقام)");
      return;
    }

    const local = cleanLocalDigits(whatsappLocal);
    const fullWithPlus = `${OMAN_PREFIX}${local}`;
    const phoneDigits = fullWithPlus.replace(/\+/g, ""); // store digits only (968XXXXXXXX)

    try {
      setSubmitting(true);

      const res = await fetch("/api/register", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          name: "",
          destination,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert("حصل خطأ أثناء التسجيل، حاول مرة أخرى");
        return;
      }

      // ✅ local guard (optional)
      setPhone(phoneDigits);

      // ✅ store form info
      const payload = {
        destination,
        whatsapp: phoneDigits,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("flyalrafah_form", JSON.stringify(payload));

      router.push("/questions");
    } catch {
      alert("تعذر الاتصال بالخادم، حاول مرة أخرى");
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            خطوة 1 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-1">معلومات رحلتك</h1>
          <p className="text-center text-sm text-zinc-500 mb-6">ادخل قرعة FlyAlrafah الشهرية 🎉</p>

          <label className="block text-sm font-medium text-zinc-700 mb-2">
            تحب تسافر مستقبلاً لأي مدينة في إيران؟
          </label>

          <div className="relative mb-5">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-purple-300"
            >
              {destinations.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">▾</span>
          </div>

          <label className="block text-sm font-medium text-zinc-700 mb-2">رقم الواتس اب</label>

          <div className="flex items-stretch gap-2 mb-6">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3">
              <span className="text-lg">🇴🇲</span>
              <span className="text-sm font-semibold">{OMAN_PREFIX}</span>
            </div>

            <div className="relative flex-1">
              <input
                inputMode="tel"
                placeholder="XXXXXXXX"
                value={whatsappLocal}
                onChange={(e) => setWhatsappLocal(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">📞</span>
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={submitting}
            className="w-full rounded-2xl py-4 bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition disabled:opacity-60"
          >
            {submitting ? "جارٍ التسجيل..." : "متابعة"}
          </button>
        </div>
      </div>
    </main>
  );
}