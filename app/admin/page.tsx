// app/admin/page.tsx
import { redirect } from "next/navigation";
import AdminClient from "./ui/AdminClient";
import { isAdminAuthenticatedServer as isAdminAuthedServer } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const ok = await isAdminAuthedServer();
  if (!ok) redirect("/admin/login");
  return <AdminClient />;
}