// app/admin/login/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image"; // ✅ اضافه شد

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function submit() {
    if (loading) return;

    setErr("");
    const pw = password.trim();
    if (!pw) {
      setErr("لطفاً رمز عبور مدیریتی را وارد نمایید.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ password: pw }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setErr("رمز عبور واردشده معتبر نمی‌باشد.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setErr("خطا در برقراری ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">

        {/* ✅ لوگو */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="FlyAlrafah"
            width={160}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        <h1 className="text-2xl font-extrabold text-zinc-900 text-center">
          سامانه مدیریت FlyAlrafah
        </h1>
        <p className="text-sm text-zinc-500 text-center mt-1 mb-6">
          ورود مدیر سیستم
        </p>

        <label className="block text-sm font-bold text-zinc-700 mb-2">
          رمز عبور مدیریتی
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={loading}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-70"
          placeholder="رمز عبور"
          autoComplete="current-password"
        />

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full mt-5 rounded-2xl py-3 bg-purple-600 text-white font-extrabold hover:bg-purple-700 disabled:opacity-70 transition"
        >
          {loading ? "در حال احراز هویت..." : "ورود به پنل مدیریت"}
        </button>


        
        <p className="mt-4 text-xs text-zinc-500 text-center leading-relaxed">
          این سیستم توسط محمود البلوشی طراحی، ایده‌پردازی و برنامه‌نویسی شده است.
          در فرآیند توسعه، تلاش بر این بوده که سامانه با بالاترین سطح دقت،
          پایداری و بهینه‌سازی ممکن پیاده‌سازی شود و عملکردی نزدیک به حداکثر
          ظرفیت استاندارد خود داشته باشد.
          <br />
          بدین‌وسیله از همکاری ارزشمند آقای ابوالفضل (مدیریت دفتر مسقط)
          در مسیر توسعه و تکمیل این سیستم صمیمانه قدردانی می‌شود.
        </p>
      </div>
    </main>
  );
}