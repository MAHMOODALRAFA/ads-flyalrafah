// app/status/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAnsweredQuestions, setPhone } from "@/app/lib/referral";

type CheckOk = {
  ok: true;
  user: {
    phone: string;
    name: string | null;
    destination: string | null;
    refCode: string;
    points: number;
    joins: number;
    sharesGiven?: number;
    lastShareAt: string | null;
    createdAt: string;
  };
  shareCooldown: {
    isBlocked: boolean;
    cooldownRemainingSec?: number;
    waitMinutes?: number;
    lastShareAt: string | null;
  };
};

type CheckResponse = CheckOk | { ok: false; error: string };

export default function StatusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const res = await fetch("/api/check", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const json = (await res.json().catch(() => null)) as CheckResponse | null;
        if (cancelled) return;

        if (!res.ok || !json) {
          setData({ ok: false, error: "server_error" });
          return;
        }

        if (json.ok === false) {
          if (json.error === "unauthorized" || json.error === "invalid_session") {
            router.replace("/start");
            return;
          }
          setData(json);
          return;
        }

        // ✅ sync phone locally (guards/keys)
        if (json.user.phone) setPhone(json.user.phone);

        setData(json);
      } catch {
        if (!cancelled) setData({ ok: false, error: "network_error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const qaDone = hasAnsweredQuestions();
  const user = data && data.ok ? data.user : null;
  const cooldown = data && data.ok ? data.shareCooldown : null;

  const remainingSec = useMemo(() => {
    if (!cooldown) return null;
    if (typeof cooldown.cooldownRemainingSec === "number") return cooldown.cooldownRemainingSec;
    if (typeof cooldown.waitMinutes === "number") return cooldown.waitMinutes * 60;
    return null;
  }, [cooldown]);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-center mb-3">
            <Image
              src="/logo.png"
              alt="FlyAlrafah"
              width={150}
              height={52}
              className="h-10 w-auto"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-2">نقاطك و رابطك</h1>
          <p className="text-center text-sm text-zinc-500 mb-6">تابع نقاطك و شارك رابطك مع الأصدقاء</p>

          {!qaDone ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-zinc-800">
              ⚠️ قبل المشاركة، أكمل 3 أسئلة سريعة لتفعيل الحساب.
            </div>
          ) : null}

          {loading ? (
            <div className="text-center text-zinc-600">جاري التحميل...</div>
          ) : !data || data.ok === false ? (
            <div className="text-center">
              <div className="text-red-600 font-semibold mb-3">حصل خطأ</div>
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-2xl py-3 bg-zinc-900 text-white font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">النقاط</div>
                <div className="text-3xl font-extrabold text-purple-700">{user!.points}</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">عدد المشاركات (Shares)</div>
                <div className="text-xl font-bold text-zinc-900">
                  {typeof user!.sharesGiven === "number" ? user!.sharesGiven : 0}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">كود الدعوة (Referral)</div>
                <div className="text-xl font-bold tracking-widest text-zinc-900">{user!.refCode}</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">عدد الأصدقاء الذين انضموا</div>
                <div className="text-xl font-bold text-zinc-900">{user!.joins}</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">حالة المشاركة</div>
                {cooldown!.isBlocked ? (
                  <div className="text-amber-700 font-semibold">
                    انتظر{" "}
                    {typeof remainingSec === "number" ? `${remainingSec} ثانية` : "قليلاً"}{" "}
                    قبل إضافة نقطة مشاركة جديدة
                  </div>
                ) : (
                  <div className="text-green-700 font-semibold">يمكنك المشاركة الآن ✅</div>
                )}
              </div>

              <button
                onClick={() => router.push(qaDone ? "/share" : "/questions")}
                className="w-full rounded-2xl py-4 bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition"
              >
                {qaDone ? "الذهاب لصفحة المشاركة" : "أكمل الأسئلة أولاً"}
              </button>

              <button
                onClick={() => router.push(qaDone ? "/share-progress" : "/questions")}
                className="w-full rounded-2xl py-3 bg-zinc-100 text-zinc-900 font-bold"
              >
                {qaDone ? "عرض التقدم" : "الذهاب للأسئلة"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}