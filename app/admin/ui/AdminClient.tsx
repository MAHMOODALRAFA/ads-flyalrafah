// app/admin/ui/AdminClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
};

type UsersRes =
  | { ok: true; users: UserRow[] }
  | { ok: false; error: string };

export default function AdminClient() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const url = q.trim()
        ? `/api/admin/users?q=${encodeURIComponent(q.trim())}`
        : "/api/admin/users";

      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as UsersRes | null;

      if (!res.ok || !json || !json.ok) {
        setErr("فشل تحميل المستخدمين (تحقق من صلاحية الدخول)");
        setUsers([]);
        return;
      }

      setUsers(json.users);
    } catch {
      setErr("تعذر الاتصال بالخادم");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPoints(userId: string, points: number) {
    const res = await fetch("/api/admin/users/set-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ userId, points }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error("fail");
  }

  async function incPoints(userId: string, delta: number) {
    const res = await fetch("/api/admin/users/inc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ userId, delta }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error("fail");
  }

  async function delUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error("fail");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", cache: "no-store" }).catch(
      () => null
    );
    window.location.href = "/admin/login";
  }

  const count = users.length;

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-zinc-900">
                لوحة الإدارة
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                المستخدمون:{" "}
                <span className="font-bold text-zinc-900">{count}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={load}
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
              onClick={load}
              className="rounded-xl px-5 py-3 bg-purple-600 text-white font-extrabold hover:bg-purple-700"
            >
              بحث
            </button>
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
                      onSet={async (p) => {
                        await setPoints(u.id, p);
                        await load();
                      }}
                      onInc={async (d) => {
                        await incPoints(u.id, d);
                        await load();
                      }}
                      onDel={async () => {
                        const ok = confirm("حذف المستخدم؟ سيتم حذف إحالاته أيضاً.");
                        if (!ok) return;
                        await delUser(u.id);
                        await load();
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 text-xs text-zinc-500">
            * ملاحظة: هذه النسخة تعرض حتى 500 مستخدم (يمكن إضافة pagination لاحقاً).
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
  onSet,
  onInc,
  onDel,
}: {
  u: UserRow;
  onSet: (points: number) => Promise<void>;
  onInc: (delta: number) => Promise<void>;
  onDel: () => Promise<void>;
}) {
  const [p, setP] = useState(String(u.points));
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const n = Number(p);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [p]);

  return (
    <tr className="border-t border-zinc-200">
      <td className="p-3 font-semibold" dir="ltr">
        {u.phone}
      </td>
      <td className="p-3">{u.name || "—"}</td>
      <td className="p-3">{u.destination || "—"}</td>
      <td className="p-3 font-mono">{u.refCode}</td>

      <td className="p-3">
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          className="w-24 rounded-lg border border-zinc-200 px-2 py-1 outline-none focus:ring-2 focus:ring-purple-300"
        />
      </td>

      <td className="p-3 text-xs text-zinc-600">{formatDt(u.lastShareAt)}</td>

      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSet(parsed);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg px-3 py-2 bg-purple-600 text-white font-bold disabled:opacity-60"
          >
            Set
          </button>

          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onInc(+1);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg px-3 py-2 bg-emerald-600 text-white font-bold disabled:opacity-60"
          >
            +1
          </button>

          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onInc(-1);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg px-3 py-2 bg-amber-500 text-white font-bold disabled:opacity-60"
          >
            -1
          </button>

          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDel();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg px-3 py-2 bg-red-600 text-white font-bold disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}