"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass }),
    });

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!data?.ok) {
      alert("Wrong admin credentials");
      return;
    }

    // ✅ مهم‌ترین تغییر
    localStorage.setItem("admin", "1");
    localStorage.setItem("admin_token", pass); // ← اضافه شد

    router.push("/admin/panel");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-6">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4 shadow">
        <h1 className="text-xl font-bold text-center">Admin Login</h1>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded-xl px-4 py-3"
          placeholder="Admin Username"
        />

        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="w-full border rounded-xl px-4 py-3"
          placeholder="Admin Password"
        />

        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold disabled:opacity-70"
        >
          {loading ? "..." : "Login"}
        </button>
      </div>
    </main>
  );
}