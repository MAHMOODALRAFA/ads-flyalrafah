"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasStarted, setPhone } from "../lib/referral";

type Destination = { value: string; label: string };

export default function StartPage() {
  const router = useRouter();

  // ✅ Guard: اگر قبلاً شروع کرده، فرم رو نشون نده
  useEffect(() => {
    if (hasStarted()) {
      router.replace("/share");
    }
  }, [router]);

  const destinations: Destination[] = useMemo(
    () => [
      { value: "shiraz", label: "شيراز" },
      { value: "tehran", label: "طهران" },
      { value: "chabahar", label: "جابهار" },
      { value: "kish", label: "جزيرة كيش" },
      { value: "bandar-abbas", label: "بندر عباس" },
      { value: "ahvaz", label: "الأهواز" },
    ],
    []
  );

  const [destination, setDestination] = useState(destinations[0]?.value ?? "");
  const [travelDate, setTravelDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [whatsapp, setWhatsapp] = useState("");

  function normalizeDigits(input: string) {
    // Persian/Arabic digits -> English digits
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
    return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  }

  function cleanPhone(input: string) {
    // Keep + and digits only
    const x = normalizeDigits(input).replace(/[^\d+]/g, "");
    return x;
  }

  function isValidWhatsapp(input: string) {
    // Accept formats like +968xxxxxxxx or 968xxxxxxxx or xxxxxxxx
    const x = cleanPhone(input);
    const digits = x.replace(/\+/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }

  async function handleNext() {
    if (!travelDate) {
      alert("الرجاء اختيار تاريخ السفر");
      return;
    }
    if (!whatsapp || !isValidWhatsapp(whatsapp)) {
      alert("الرجاء إدخال رقم واتساب صحيح");
      return;
    }

    const cleaned = cleanPhone(whatsapp);
    const phoneDigits = cleaned.replace(/\+/g, ""); // ✅ فقط أرقام

    // ✅ ثبت نام در دیتابیس
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits, // ✅ همین باید بره API
          name: "", // فعلاً خالی (بعداً فیلد اسم اضافه می‌کنیم)
          destination,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert("حصل خطأ أثناء التسجيل، حاول مرة أخرى");
        return;
      }
    } catch {
      alert("تعذر الاتصال بالخادم، حاول مرة أخرى");
      return;
    }

    // ✅ مهم: نخزن رقم الهاتف داخل نظام referral (عشان hasStarted/guards)
    setPhone(phoneDigits); // ✅ اینجا هم digits

    // Later we will save this to DB. For now, store in localStorage
    const payload = {
      destination,
      travelDate,
      passengers,
      whatsapp: phoneDigits, // ✅ اینجا هم digits
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("flyalrafah_form", JSON.stringify(payload));

    router.push("/share");
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            خطوة 1 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-6">
            معلومات رحلتك
          </h1>

          {/* Destination */}
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            الوجهة
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
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              ▾
            </span>
          </div>

          {/* Date */}
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            تاريخ السفر
          </label>
          <div className="relative mb-5">
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          {/* Passengers */}
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            عدد المسافرين
          </label>
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 mb-5">
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 font-bold"
              onClick={() => setPassengers((p) => Math.max(1, p - 1))}
            >
              -
            </button>
            <div className="text-zinc-900 font-semibold">{passengers}</div>
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 font-bold"
              onClick={() => setPassengers((p) => Math.min(9, p + 1))}
            >
              +
            </button>
          </div>

          {/* WhatsApp */}
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            رقم الواتس اب
          </label>
          <div className="relative mb-6">
            <input
              inputMode="tel"
              placeholder="+968XXXXXXXX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-purple-300"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              📞
            </span>
          </div>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full rounded-2xl py-4 bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition"
          >
            متابعة
          </button>
        </div>
      </div>
    </main>
  );
}
