// app/admin/ui/AdminClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
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

type UsersRes =
  | { ok: true; users: UserRow[]; pagination: Pagination }
  | { ok: false; error?: string };

export default function AdminClient() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [err, setErr] = useState("");

  const [busyId, setBusyId] = useState<string>("");

  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });

  // debounce
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

  async function loadUsers(page?: number, pageSize?: number, query?: string) {
    setErr("");
    setLoading(true);

    const nextPage = page ?? pagination.page;
    const nextPageSize = pageSize ?? pagination.pageSize;
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

      const json = (await res.json().catch(() => null)) as UsersRes | null;

      if (!res.ok || !json || !json.ok) {
        setErr("فشل تحميل المستخدمين");
        setUsers([]);
        setPagination((p) => ({ ...p, total: 0, totalPages: 1, page: 1 }));
        return;
      }

      setUsers(Array.isArray(json.users) ? json.users : []);
      setPagination(json.pagination);
    } catch {
      setErr("تعذر الاتصال بالخادم");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function changePoints(userId: string, amount: number) {
    if (!userId || busyId) return;
    setBusyId(userId);
    setErr("");

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

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr("لم يتم تحديث النقاط");
        return;
      }

      await loadUsers(pagination.page, pagination.pageSize, debouncedQ);
    } catch {
      setErr("خطأ في الاتصال بالخادم");
    } finally {
      setBusyId("");
    }
  }

  async function resetUser(userId: string) {
    if (!userId || busyId) return;

    const ok = confirm("Reset this user points (and lastShareAt)?");
    if (!ok) return;

    setBusyId(userId);
    setErr("");

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

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr("لم يتم إعادة ضبط المستخدم");
        return;
      }

      await loadUsers(pagination.page, pagination.pageSize, debouncedQ);
    } catch {
      setErr("خطأ في الاتصال بالخادم");
    } finally {
      setBusyId("");
    }
  }

  async function logout() {
    setErr("");
    try {
      await fetch("/api/admin/logout", { method: "POST", cache: "no-store" }).catch(
        () => null
      );
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  const count = pagination.total;

  const canPrev = pagination.page > 1;
  const canNext = pagination.page < pagination.totalPages;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-zinc-900">لوحة الإدارة</h1>
              <p className="text-sm text-zinc-500 mt-1">
                إجمالي المستخدمين:{" "}
                <span className="font-bold text-zinc-900">{count}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => loadUsers(pagination.page, pagination.pageSize, debouncedQ)}
                className="rounded-xl px-4 py-2 bg-zinc-900 text-white font-bold hover:opacity-95"
              >
                تحديث
              </button>
              <button
                onClick={logout}
                className="rounded-xl px-4 py-2 bg-zinc-100 text-zinc-900 font-bold hover:bg-zinc-200"
              >
                خروج
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث: رقم / refCode / اسم"
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={() => loadUsers(1, pagination.pageSize, q.trim())}
              className="rounded-xl px-5 py-3 bg-purple-600 text-white font-extrabold hover:bg-purple-700"
            >
              بحث
            </button>
          </div>

          {/* Paging */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-zinc-500">
              {loading
                ? "جارٍ التحميل..."
                : `صفحة ${pagination.page} من ${pagination.totalPages} — النتائج: ${users.length}`}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => loadUsers(1, pagination.pageSize, debouncedQ)}
                disabled={loading || pagination.page === 1}
                className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
              >
                أول صفحة
              </button>

              <button
                onClick={() => loadUsers(pagination.page - 1, pagination.pageSize, debouncedQ)}
                disabled={loading || !canPrev}
                className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
              >
                السابق
              </button>

              <button
                onClick={() => loadUsers(pagination.page + 1, pagination.pageSize, debouncedQ)}
                disabled={loading || !canNext}
                className="h-10 rounded-2xl px-4 bg-white border border-zinc-200 text-zinc-800 font-bold hover:bg-zinc-100 transition disabled:opacity-60"
              >
                التالي
              </button>

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
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-center text-zinc-600">جارٍ التحميل...</div>
          ) : (
            <div className="mt-6 overflow-auto rounded-2xl border border-zinc-200">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-zinc-600">
                    <th className="p-3 text-right">الهاتف</th>
                    <th className="p-3 text-right">الاسم</th>
                    <th className="p-3 text-right">الوجهة</th>
                    <th className="p-3 text-right">refCode</th>
                    <th className="p-3 text-right">النقاط</th>
                    <th className="p-3 text-right">آخر مشاركة</th>
                    <th className="p-3 text-right">تحكم</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => (
                    <Row
                      key={u.id}
                      u={u}
                      busy={busyId === u.id}
                      onInc={async (delta) => changePoints(u.id, delta)}
                      onReset={async () => resetUser(u.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 text-xs text-zinc-500">
            * هذا العرض يستخدم pagination ويعتمد على Cookie Admin.
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDt(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function Row({
  u,
  busy,
  onInc,
  onReset,
}: {
  u: UserRow;
  busy: boolean;
  onInc: (delta: number) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  return (
    <tr className="border-t border-zinc-200">
      <td className="p-3 font-semibold" dir="ltr">
        {u.phone}
      </td>
      <td className="p-3">{u.name || "—"}</td>
      <td className="p-3">{u.destination || "—"}</td>
      <td className="p-3 font-mono">{u.refCode}</td>

      <td className="p-3 font-extrabold text-purple-700">{u.points}</td>

      <td className="p-3 text-xs text-zinc-600">{formatDt(u.lastShareAt)}</td>

      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => onInc(+10)}
            className="rounded-lg px-3 py-2 bg-emerald-600 text-white font-bold disabled:opacity-60"
          >
            +10
          </button>

          <button
            disabled={busy}
            onClick={() => onInc(-10)}
            className="rounded-lg px-3 py-2 bg-amber-500 text-white font-bold disabled:opacity-60"
          >
            -10
          </button>

          <button
            disabled={busy}
            onClick={onReset}
            className="rounded-lg px-3 py-2 bg-red-600 text-white font-bold disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </td>
    </tr>
  );
}