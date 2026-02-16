"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPhone, hasStarted } from "@/app/lib/referral";

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

    const phone = getPhone();
    if (!phone) {
      router.replace("/start");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });

        const json = (await res.json().catch(() => null)) as CheckResponse | null;

        if (!res.ok || !json) {
          setData({ ok: false, error: "server_error" });
        } else {
          setData(json);
        }
      } catch {
        setData({ ok: false, error: "network_error" });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const user = data && data.ok ? data.user : null;
  const cooldown = data && data.ok ? data.shareCooldown : null;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* ✅ Logo (small, no layout break) */}
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

          <h1 className="text-2xl font-bold text-center text-zinc-900 mb-2">
            نقاطك و رابطك
          </h1>
          <p className="text-center text-sm text-zinc-500 mb-6">
            تابع نقاطك و شارك رابطك مع الأصدقاء
          </p>

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
              {/* Points */}
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">النقاط</div>
                <div className="text-3xl font-extrabold text-purple-700">{user!.points}</div>
              </div>

              {/* Ref Code */}
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">كود الدعوة (Referral)</div>
                <div className="text-xl font-bold tracking-widest text-zinc-900">
                  {user!.refCode}
                </div>
              </div>

              {/* Joins */}
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">عدد الأصدقاء الذين انضموا</div>
                <div className="text-xl font-bold text-zinc-900">{user!.joins}</div>
              </div>

              {/* Share cooldown */}
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm text-zinc-500 mb-1">حالة المشاركة</div>
                {cooldown!.isBlocked ? (
                  <div className="text-amber-700 font-semibold">
                    انتظر {cooldown!.waitMinutes} دقيقة قبل إضافة نقطة مشاركة جديدة
                  </div>
                ) : (
                  <div className="text-green-700 font-semibold">يمكنك المشاركة الآن ✅</div>
                )}
              </div>

              <button
                onClick={() => router.push("/share")}
                className="w-full rounded-2xl py-4 bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition"
              >
                الذهاب لصفحة المشاركة
              </button>

              <button
                onClick={() => router.push("/share-progress")}
                className="w-full rounded-2xl py-3 bg-zinc-100 text-zinc-900 font-bold"
              >
                عرض التقدم
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
