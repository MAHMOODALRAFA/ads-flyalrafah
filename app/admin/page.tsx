// app/admin/page.tsx
import { redirect } from "next/navigation";
import { isAdminAuthenticatedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const ok = await isAdminAuthenticatedServer();
  if (!ok) redirect("/admin/login");
  redirect("/admin/panel");
}