"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  phone: string;
  points: number;
  joins: number; // computed from referralsGiven count
  refCode: string;
  lastShareAt: string | null;
  createdAt: string;
};

type UsersResponse =
  | { ok: true; users: UserRow[] }
  | { ok: false; error?: string };

export default function AdminPanelPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [q, setQ] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("admin") !== "1") {
      router.replace("/admin");
      return;
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as UsersResponse | null;

      if (!res.ok || !data || !data.ok) {
        setError("تعذر تحميل قائمة المستخدمين");
        setUsers([]);
        return;
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError("خطأ في الاتصال بالخادم");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function changePoints(userId: string, amount: number) {
    if (!userId || busyId) return;
    setBusyId(userId);
    setError("");

    try {
      const res = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("لم يتم تحديث النقاط");
        return;
      }

      await loadUsers();
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setBusyId("");
    }
  }

  async function resetUser(userId: string) {
    if (!userId || busyId) return;

    const ok = confirm("Reset this user points (and lastShareAt)?");
    if (!ok) return;

    setBusyId(userId);
    setError("");

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("لم يتم إعادة ضبط المستخدم");
        return;
      }

      await loadUsers();
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setBusyId("");
    }
  }

  const filtered = useMemo(() => {
    const x = q.trim().toLowerCase();
    if (!x) return users;

    return users.filter((u) => {
      return (
        (u.phone || "").toLowerCase().includes(x) ||
        (u.refCode || "").toLowerCase().includes(x)
      );
    });
  }, [q, users]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalPoints = users.reduce((sum, u) => sum + Number(u.points || 0), 0);
    const totalJoins = users.reduce((sum, u) => sum + Number(u.joins || 0), 0);
    return { totalUsers, totalPoints, totalJoins };
  }, [users]);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900">لوحة التحكم</h1>
            <p className="text-sm text-zinc-500 mt-1">
              إدارة المستخدمين والنقاط — FlyAlrafah
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadUsers}
              className="h-11 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition"
            >
              تحديث
            </button>

            <button
              onClick={() => {
                localStorage.removeItem("admin");
                router.replace("/admin");
              }}
              className="h-11 rounded-2xl px-4 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
            >
              خروج
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">عدد المستخدمين</div>
            <div className="text-2xl font-extrabold text-zinc-900 mt-1">
              {stats.totalUsers}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">مجموع النقاط</div>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">
              {stats.totalPoints}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">مجموع الانضمامات</div>
            <div className="text-2xl font-extrabold text-zinc-900 mt-1">
              {stats.totalJoins}
            </div>
          </div>
        </div>

        {/* Search + Error */}
        <div className="rounded-2xl bg-white border border-zinc-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="text-sm font-bold text-zinc-900 mb-2">بحث</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث برقم الهاتف أو كود الدعوة..."
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div className="text-sm text-zinc-500 sm:text-left">
              {loading ? "جارٍ التحميل..." : `النتائج: ${filtered.length}`}
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        {/* List */}
        <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
            <div className="text-sm font-extrabold text-zinc-900">المستخدمون</div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-zinc-600">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-zinc-600">لا يوجد نتائج</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filtered.map((u) => {
                const busy = busyId === u.id;

                return (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col md:flex-row md:items-center gap-3"
                  >
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <div className="font-bold text-zinc-900" dir="ltr">
                          📞 {u.phone}
                        </div>
                        <div className="text-zinc-500">
                          Code:{" "}
                          <span className="font-bold text-zinc-900">{u.refCode}</span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                          <div className="text-[11px] text-zinc-500">Points</div>
                          <div className="text-lg font-extrabold text-purple-700">
                            {u.points}
                          </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                          <div className="text-[11px] text-zinc-500">Joins</div>
                          <div className="text-lg font-extrabold text-zinc-900">
                            {u.joins}
                          </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                          <div className="text-[11px] text-zinc-500">Last Share</div>
                          <div className="text-xs font-bold text-zinc-700" dir="ltr">
                            {u.lastShareAt ? new Date(u.lastShareAt).toLocaleString() : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => changePoints(u.id, 10)}
                        disabled={busyId !== "" && !busy}
                        className="h-11 rounded-2xl px-4 bg-green-600 text-white font-extrabold hover:bg-green-700 transition disabled:opacity-60"
                      >
                        {busy ? "..." : "+10"}
                      </button>

                      <button
                        onClick={() => changePoints(u.id, -10)}
                        disabled={busyId !== "" && !busy}
                        className="h-11 rounded-2xl px-4 bg-amber-500 text-white font-extrabold hover:bg-amber-600 transition disabled:opacity-60"
                      >
                        {busy ? "..." : "-10"}
                      </button>

                      <button
                        onClick={() => resetUser(u.id)}
                        disabled={busyId !== "" && !busy}
                        className="h-11 rounded-2xl px-4 bg-red-600 text-white font-extrabold hover:bg-red-700 transition disabled:opacity-60"
                      >
                        {busy ? "..." : "Reset"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-4">
          * Joins يتم حسابها من جدول Referral تلقائياً
        </p>
      </div>
    </main>
  );
}