// app/admin/login/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      setErr("اكتب كلمة المرور");
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
        setErr("كلمة المرور غير صحيحة");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setErr("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-extrabold text-zinc-900 text-center">لوحة الإدارة</h1>
        <p className="text-sm text-zinc-500 text-center mt-1 mb-6">تسجيل الدخول</p>

        <label className="block text-sm font-bold text-zinc-700 mb-2">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={loading}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-70"
          placeholder="••••••••"
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
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        <div className="mt-4 text-xs text-zinc-500 text-center">
          الرابط: <span className="font-bold">/admin/login</span>
        </div>
      </div>
    </main>
  );
}