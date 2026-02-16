"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FriendRegisteredPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/share-progress");
      router.refresh(); // optional: ensures fresh DB state
    }, 1200);

    return () => clearTimeout(t);
  }, [router]);

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-zinc-900">تم تأكيد تسجيل صديق</h1>
        <p className="text-zinc-500 mt-2">جاري تحديث التقدّم...</p>
      </div>
    </main>
  );
}
