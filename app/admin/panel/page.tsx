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

  useEffect(() => {
    if (localStorage.getItem("admin") !== "1") {
      router.replace("/admin");
      return;
    }

    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.ok) setUsers(data.users);
  }

  async function changePoints(id: string, amount: number) {
    await fetch("/api/admin/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, amount }),
    });
    loadUsers();
  }

  async function resetUser(id: string) {
    if (!confirm("Reset this user?")) return;

    await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    loadUsers();
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="border rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <div>📞 {u.phone}</div>
              <div>Points: {u.points}</div>
              <div>Joins: {u.joins}</div>
              <div>Code: {u.refCode}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => changePoints(u.id, 10)}
                className="px-3 py-1 bg-green-500 text-white rounded"
              >
                +10
              </button>

              <button
                onClick={() => changePoints(u.id, -10)}
                className="px-3 py-1 bg-yellow-500 text-white rounded"
              >
                -10
              </button>

              <button
                onClick={() => resetUser(u.id)}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
