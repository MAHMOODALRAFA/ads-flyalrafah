// lib/adminAuth.ts
import "server-only";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "flyalrafah_admin";

export async function isAdminAuthenticatedServer(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === "1";
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();

  store.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();

  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}