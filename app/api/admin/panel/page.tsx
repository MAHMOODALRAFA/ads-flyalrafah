"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  phone: string;
  points: number;
  joins: number;
  refCode: string;
};

export default function AdminPanel() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const ok = localStorage.getItem("admin") === "1";
    if (!ok) {
      router.replace("/admin");
      return;
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setErr("");

      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErr(`API error: ${res.status} ${res.statusText}`);
        setUsers([]);
        return;
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function changePoints(id: string, amount: number) {
    try {
      const res = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert("Failed to update points");
        return;
      }
      loadUsers();
    } catch {
      alert("Network error");
    }
  }

  async function resetUser(id: string) {
    if (!confirm("Reset this user?")) return;

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert("Failed to reset user");
        return;
      }
      loadUsers();
    } catch {
      alert("Network error");
    }
  }

  return (
    <main className="min-h-screen p-6 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Admin Panel</h1>

          <button
            onClick={loadUsers}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl p-5 shadow">
            Loading users...
          </div>
        )}

        {!loading && err && (
          <div className="bg-white rounded-2xl p-5 shadow border border-red-200">
            <div className="text-red-600 font-bold mb-2">Error</div>
            <div className="text-zinc-700 text-sm">{err}</div>

            <div className="mt-3 text-xs text-zinc-500">
              جرّب فتح: <span className="font-mono">/api/admin/users</span>
            </div>
          </div>
        )}

        {!loading && !err && users.length === 0 && (
          <div className="bg-white rounded-2xl p-5 shadow">
            No users yet.
          </div>
        )}

        {!loading && !err && users.length > 0 && (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-2xl p-4 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="font-bold">📞 {u.phone}</div>
                  <div className="text-sm text-zinc-600">
                    Points: <span className="font-bold">{u.points}</span> • Joins:{" "}
                    <span className="font-bold">{u.joins}</span>
                  </div>
                  <div className="text-sm text-zinc-600">
                    Code: <span className="font-mono font-bold">{u.refCode}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => changePoints(u.id, 10)}
                    className="px-3 py-2 rounded-xl bg-green-600 text-white font-bold"
                  >
                    +10
                  </button>

                  <button
                    onClick={() => changePoints(u.id, -10)}
                    className="px-3 py-2 rounded-xl bg-amber-500 text-white font-bold"
                  >
                    -10
                  </button>

                  <button
                    onClick={() => resetUser(u.id)}
                    className="px-3 py-2 rounded-xl bg-red-600 text-white font-bold"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
