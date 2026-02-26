"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ReferralRow = {
  id: string;
  referredPhone: string;
  createdAt: string;
};

type AnswerRow = {
  destination: string | null;
  q1: string;
  q2: string;
  updatedAt: string;
};

type UserDetail = {
  id: string;
  phone: string;
  name: string | null;
  destination: string | null;
  refCode: string;
  points: number;
  lastShareAt: string | null;
  createdAt: string;
  updatedAt: string;
  referralsGiven: ReferralRow[];
  _count: { referralsGiven: number };
  answer?: AnswerRow | null;
};

type DetailResponse =
  | { ok: true; user: UserDetail }
  | { ok: false; error?: string };

function fmtDate(x: string | null | undefined) {
  if (!x) return "—";
  try {
    return new Date(x).toLocaleString();
  } catch {
    return "—";
  }
}

function mapDestinationLabel(value: string | null | undefined) {
  const v = String(value || "").trim();
  const map: Record<string, string> = {
    shiraz: "شيراز",
    tehran: "طهران",
    mashhad: "مشهد",
    chabahar: "جابهار",
    kish: "جزيرة كيش",
    "bandar-abbas": "بندر عباس",
    ahvaz: "الأهواز",
  };
  return map[v] || (v ? v : "—");
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = String((params as any)?.id || "");
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadUser() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/users/${id}/detail`, {
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as DetailResponse | null;

      if (!res.ok || !data || !data.ok) {
        setError("تعذر تحميل بيانات المستخدم");
        setUser(null);
        return;
      }

      setUser(data.user);
    } catch {
      setError("خطأ في الاتصال بالخادم");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const joinsCount = useMemo(() => {
    return Number(user?._count?.referralsGiven || 0);
  }, [user]);

  async function copyText(x: string) {
    try {
      await navigator.clipboard.writeText(x);
      setToast("تم النسخ ✅");
    } catch {
      setToast("تعذر النسخ");
    }
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="p-10 text-center text-zinc-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm font-bold text-purple-700"
          >
            ← رجوع
          </button>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Toast */}
        {toast ? (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-zinc-900 text-white px-4 py-2 text-sm shadow-lg">
            {toast}
          </div>
        ) : null}

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm font-bold text-purple-700 hover:opacity-80 transition"
          >
            ← رجوع
          </button>

          <button
            onClick={loadUser}
            className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition"
          >
            تحديث
          </button>
        </div>

        {/* Profile */}
        <div className="rounded-2xl bg-white border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xl font-extrabold text-zinc-900">
                👤 تفاصيل المستخدم
              </div>
              <div className="text-sm text-zinc-500 mt-1">
                FlyAlrafah Referral Admin
              </div>
            </div>

            <div className="rounded-2xl bg-purple-50 border border-purple-100 px-4 py-2">
              <div className="text-[11px] text-purple-700 font-bold">Points</div>
              <div className="text-xl font-extrabold text-purple-700">
                {user.points}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">رقم الهاتف</div>
              <div className="mt-1 font-extrabold text-zinc-900" dir="ltr">
                {user.phone}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => copyText(user.phone)}
                  className="h-9 rounded-2xl px-3 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Ref Code</div>
              <div className="mt-1 font-extrabold text-zinc-900">
                {user.refCode}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => copyText(user.refCode)}
                  className="h-9 rounded-2xl px-3 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">المدينة المختارة</div>
              <div className="mt-1 font-extrabold text-zinc-900">
                {mapDestinationLabel(user.destination)}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Joins</div>
              <div className="mt-1 font-extrabold text-zinc-900">{joinsCount}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Last Share</div>
              <div className="mt-1 font-bold text-zinc-800" dir="ltr">
                {fmtDate(user.lastShareAt)}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Created</div>
              <div className="mt-1 font-bold text-zinc-800" dir="ltr">
                {fmtDate(user.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Answers */}
        <div className="mt-4 rounded-2xl bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-extrabold text-zinc-900">🧠 إجابات الأسئلة</div>
            <div className="text-xs text-zinc-500" dir="ltr">
              {user.answer?.updatedAt ? fmtDate(user.answer.updatedAt) : ""}
            </div>
          </div>

          {!user.answer ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              لا توجد إجابات محفوظة لهذا المستخدم (قد يكون ما كمل الأسئلة).
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-xs text-zinc-500">المدينة (Snapshot)</div>
                <div className="mt-1 font-extrabold text-zinc-900">
                  {mapDestinationLabel(user.answer.destination)}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs text-zinc-500">Q1</div>
                <div className="mt-1 font-bold text-zinc-900">{user.answer.q1}</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs text-zinc-500">Q2</div>
                <div className="mt-1 font-bold text-zinc-900">{user.answer.q2}</div>
              </div>
            </div>
          )}
        </div>

        {/* Referrals */}
        <div className="mt-4 rounded-2xl bg-white border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-extrabold text-zinc-900">
              👥 Joins / Referrals
            </div>
            <div className="text-xs text-zinc-500">
              العدد: <span className="font-bold">{user.referralsGiven?.length || 0}</span>
            </div>
          </div>

          {!user.referralsGiven || user.referralsGiven.length === 0 ? (
            <div className="text-zinc-500 text-sm">No referrals</div>
          ) : (
            <div className="space-y-2">
              {user.referralsGiven.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-zinc-900" dir="ltr">
                      📞 {r.referredPhone}
                    </div>
                    <div className="text-xs text-zinc-500" dir="ltr">
                      {fmtDate(r.createdAt)}
                    </div>
                  </div>

                  <button
                    onClick={() => copyText(r.referredPhone)}
                    className="h-10 rounded-2xl px-4 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-zinc-400">
          FlyAlrafah Admin • User Detail
        </div>
      </div>
    </main>
  );
}