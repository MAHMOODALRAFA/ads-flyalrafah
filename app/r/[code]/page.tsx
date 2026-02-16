"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type JoinResponse =
  | {
      ok: true;
      credited: boolean;
      addedPoints?: number;
      reason?: "already_joined" | "invalid_ref" | "self_join" | string;
    }
  | { ok: false; error: string };

function normalizeDigits(input: string) {
  const map: Record<string, string> = {
    "٠": "0","١": "1","٢": "2","٣": "3","٤": "4","٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
    "۰": "0","۱": "1","۲": "2","۳": "3","۴": "4","۵": "5","۶": "6","۷": "7","۸": "8","۹": "9",
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

function cleanPhone(input: string) {
  return normalizeDigits(String(input || "")).replace(/[^\d+]/g, "");
}

function isValidWhatsapp(input: string) {
  const x = cleanPhone(input);
  const digits = x.replace(/\+/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export default function ReferralJoinPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();

  const refCode = useMemo(() => String(params?.code || "").trim(), [params]);

  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;

    if (!refCode) {
      alert("رابط غير صحيح");
      router.replace("/");
      return;
    }

    if (!whatsapp || !isValidWhatsapp(whatsapp)) {
      alert("الرجاء إدخال رقم واتساب صحيح");
      return;
    }

    const referredPhone = cleanPhone(whatsapp).replace(/\+/g, "");

    try {
      setSubmitting(true);

      const res = await fetch("/api/referral/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refCode, referredPhone }),
      });

      const data = (await res.json().catch(() => null)) as JoinResponse | null;

      if (!res.ok || !data) {
        alert("حصل خطأ، حاول مرة أخرى");
        return;
      }

      if (!data.ok) {
        // error codes from API
        if (data.error === "invalid_ref_code") {
          alert("هذا الرابط غير صالح");
          return;
        }
        if (data.error === "already_joined") {
          alert("تم تسجيلك مسبقاً ✅");
          router.replace("/friend-registered");
          return;
        }
        if (data.error === "self_join_not_allowed") {
          alert("لا يمكن استخدام رابطك لتسجيل نفسك");
          return;
        }
        alert("حصل خطأ، حاول مرة أخرى");
        return;
      }

      // ok
      if (data.credited === false) {
        alert("تم تسجيلك مسبقاً ✅");
      } else {
        alert("تم تسجيلك ✅ شكراً لك");
      }

      // ✅ UX flow: success page
      router.replace("/friend-registered");
    } catch {
      alert("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center text-zinc-900 mb-2">أهلاً بك 👋</h1>
        <p className="text-center text-sm text-zinc-500 mb-6">أدخل رقم واتسابك لتسجيل الانضمام</p>

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 mb-4">
          <div className="text-xs text-zinc-500 mb-1">Referral Code</div>
          <div className="font-bold tracking-widest text-zinc-900">{refCode}</div>
        </div>

        <label className="block text-sm font-medium text-zinc-700 mb-2">رقم الواتس اب</label>
        <input
          inputMode="tel"
          placeholder="+968XXXXXXXX"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-purple-300 mb-5"
        />

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-2xl py-4 bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition disabled:opacity-60"
        >
          {submitting ? "جارٍ الإرسال..." : "تأكيد الانضمام"}
        </button>
      </div>
    </main>
  );
}