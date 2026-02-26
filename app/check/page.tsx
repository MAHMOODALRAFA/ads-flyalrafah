// app/check/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasStarted, hasAnsweredQuestions } from "@/app/lib/referral";

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
        sharesGiven: number;
        lastShareAt: string | null;
        createdAt: string;
      };
      shareCooldown: {
        isBlocked: boolean;
        waitMinutes: number;
        lastShareAt: string | null;
      };
    }
  | { ok: false; error: string };

export default function CheckPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckResponse | null>(null);

  useEffect(() => {
    if (!hasStarted()) {
      router.replace("/start");
      return;
    }

    if (!hasAnsweredQuestions()) {
      router.replace("/questions");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);

        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        const json = (await res.json().catch(() => null)) as CheckResponse | null;

        if (cancelled) return;

        if (!res.ok || !json) {
          setData({ ok: false, error: "server_error" });
        } else {
          setData(json);
        }
      } catch {
        if (!cancelled) setData({ ok: false, error: "network_error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const user = data && data.ok ? data.user : null;
  const cooldown = data && data.ok ? data.shareCooldown : null;

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-zinc-600">جارٍ التحميل...</div>
      </main>
    );
  }

  if (!data || data.ok === false || !user) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center">
          <div className="text-red-600 font-bold mb-3">حصل خطأ</div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-2xl bg-zinc-900 text-white font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div className="flex justify-center mb-2">
            <Image
              src="/logo.png"
              alt="FlyAlrafah"
              width={150}
              height={52}
              className="h-10 w-auto"
              priority
            />
          </div>

          <h1 className="text-2xl font-extrabold text-center text-zinc-900">
            نقاطك و رابطك
          </h1>

          <div className="rounded-2xl border border-zinc-200 p-4 text-center">
            <div className="text-xs text-zinc-500">النقاط</div>
            <div className="text-3xl font-extrabold text-purple-700">{user.points}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 text-center">
            <div className="text-xs text-zinc-500">كود الدعوة</div>
            <div className="text-xl font-bold tracking-widest text-zinc-900">
              {user.refCode}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 text-center">
            <div className="text-xs text-zinc-500">المشاركات</div>
            <div className="text-xl font-bold text-zinc-900">{user.sharesGiven}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 text-center">
            <div className="text-xs text-zinc-500">الأصدقاء المنضمّون</div>
            <div className="text-xl font-bold text-zinc-900">{user.joins}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 text-center">
            <div className="text-xs text-zinc-500">حالة المشاركة</div>
            {cooldown?.isBlocked ? (
              <div className="text-amber-700 font-bold">انتظر {cooldown.waitMinutes} دقيقة</div>
            ) : (
              <div className="text-emerald-600 font-bold">يمكنك المشاركة الآن ✅</div>
            )}
          </div>

          <button
            onClick={() => router.push("/share")}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold"
          >
            الذهاب لصفحة المشاركة
          </button>
        </div>
      </div>
    </main>
  );
}