// app/admin/panel/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiUser = {
  id: string;
  phone: string;
  name: string | null;
  destination: string | null;
  refCode: string;
  points: number;
  lastShareAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { referralsGiven?: number };
};

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type UsersResponse =
  | { ok: true; users: ApiUser[]; pagination: Pagination }
  | { ok: false; error?: string };

export default function AdminPanelPage() {
  const router = useRouter();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });

  // ✅ FIX: لازم است false باشد تا اولین loadUsers بلاک نشود
  const [loading, setLoading] = useState(false);

  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    loadUsers(1, pagination.pageSize, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers(1, pagination.pageSize, debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  function goUser(id: string) {
    router.push(`/admin/user/${id}`);
  }

  async function loadUsers(page?: number, pageSize?: number, query?: string) {
    // ✅ FIX: حذف useState از داخل تابع (Hook داخل function ممنوع است)
    setError("");
    setLoading(true);

    const nextPage = Math.max(1, Number(page ?? pagination.page) || 1);
    const nextPageSizeRaw = Number(pageSize ?? pagination.pageSize) || 20;
    const nextPageSize = Math.min(100, Math.max(1, nextPageSizeRaw));
    const nextQ = query ?? debouncedQ;

    try {
      const params = new URLSearchParams();
      if (nextQ) params.set("q", nextQ);
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextPageSize));

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => null)) as UsersResponse | null;

      if (!res.ok || !data || !data.ok) {
        setError("تعذر تحميل قائمة المستخدمين");
        setUsers([]);
        setPagination((p) => ({ ...p, total: 0, totalPages: 1, page: 1 }));
        return;
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
      setPagination({
        total: Number(data.pagination?.total ?? 0),
        page: Math.max(1, Number(data.pagination?.page ?? 1)),
        pageSize: Math.min(
          100,
          Math.max(1, Number(data.pagination?.pageSize ?? 20))
        ),
        totalPages: Math.max(1, Number(data.pagination?.totalPages ?? 1)),
      });
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
        cache: "no-store",
        body: JSON.stringify({ userId, amount }),
      });

      if (res.status === 401) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("لم يتم تحديث النقاط");
        return;
      }

      await loadUsers(pagination.page, pagination.pageSize, debouncedQ);
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
        cache: "no-store",
        body: JSON.stringify({ userId }),
      });

      if (res.status === 401) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("لم يتم إعادة ضبط المستخدم");
        return;
      }

      await loadUsers(pagination.page, pagination.pageSize, debouncedQ);
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setBusyId("");
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST", cache: "no-store" }).catch(
        () => null
      );
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  const stats = useMemo(() => {
    const pageUsers = users.length;
    const pagePoints = users.reduce((sum, u) => sum + Number(u.points || 0), 0);
    const pageJoins = users.reduce(
      (sum, u) => sum + Number(u._count?.referralsGiven || 0),
      0
    );
    return { pageUsers, pagePoints, pageJoins };
  }, [users]);

  const canPrev = pagination.page > 1;
  const canNext = pagination.page < pagination.totalPages;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900">لوحة التحكم</h1>
            <p className="text-sm text-zinc-500 mt-1">
              إدارة المستخدمين والنقاط — FlyAlrafah
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              إجمالي المستخدمين:{" "}
              <span className="font-bold">{pagination.total}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadUsers(pagination.page, pagination.pageSize, debouncedQ)}
              disabled={loading}
              className="h-11 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
            >
              تحديث
            </button>

            <button
              onClick={logout}
              className="h-11 rounded-2xl px-4 bg-zinc-900 text-white font-bold hover:opacity-90 transition"
            >
              خروج
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">مستخدمون في هذه الصفحة</div>
            <div className="text-2xl font-extrabold text-zinc-900 mt-1">
              {stats.pageUsers}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">مجموع نقاط هذه الصفحة</div>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">
              {stats.pagePoints}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">مجموع الانضمامات (هذه الصفحة)</div>
            <div className="text-2xl font-extrabold text-zinc-900 mt-1">
              {stats.pageJoins}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-200 p-4 mb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="text-sm font-bold text-zinc-900 mb-2">بحث</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث برقم الهاتف أو كود الدعوة أو الاسم..."
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="text-sm text-zinc-500 sm:text-left">
                {loading
                  ? "جارٍ التحميل..."
                  : `صفحة ${pagination.page} من ${pagination.totalPages} — النتائج: ${users.length}`}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => loadUsers(1, pagination.pageSize, debouncedQ)}
                  disabled={loading || pagination.page === 1}
                  className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
                >
                  أول صفحة
                </button>

                <button
                  onClick={() =>
                    loadUsers(pagination.page - 1, pagination.pageSize, debouncedQ)
                  }
                  disabled={loading || !canPrev}
                  className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
                >
                  السابق
                </button>

                <button
                  onClick={() =>
                    loadUsers(pagination.page + 1, pagination.pageSize, debouncedQ)
                  }
                  disabled={loading || !canNext}
                  className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
                >
                  التالي
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-500">حجم الصفحة</div>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => {
                    const ps = Number(e.target.value || 20);
                    loadUsers(1, ps, debouncedQ);
                  }}
                  className="h-10 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-purple-300"
                >
                  {[10, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div className="text-sm font-extrabold text-zinc-900">المستخدمون</div>
            <div className="text-xs text-zinc-500">
              إجمالي: <span className="font-bold">{pagination.total}</span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-zinc-600">جاري التحميل...</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-zinc-600">لا يوجد نتائج</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {users.map((u) => {
                const busy = busyId === u.id;
                const joins = Number(u._count?.referralsGiven || 0);

                return (
                  <div
                    key={u.id}
                    onClick={() => goUser(u.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center gap-3 cursor-pointer hover:bg-zinc-50 transition"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <div className="font-bold text-zinc-900" dir="ltr">
                          📞 {u.phone}
                        </div>
                        <div className="text-zinc-500">
                          Code:{" "}
                          <span className="font-bold text-zinc-900">{u.refCode}</span>
                        </div>
                        {u.name ? (
                          <div className="text-zinc-500">
                            الاسم:{" "}
                            <span className="font-bold text-zinc-900">{u.name}</span>
                          </div>
                        ) : null}
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
                            {joins}
                          </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-center">
                          <div className="text-[11px] text-zinc-500">Last Share</div>
                          <div className="text-xs font-bold text-zinc-700" dir="ltr">
                            {u.lastShareAt
                              ? new Date(u.lastShareAt).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap gap-2 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
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
          * Joins يتم حسابها من جدول Referral تلقائياً (referralsGiven count)
        </p>
      </div>
    </main>
  );
}