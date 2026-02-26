import { cookies } from "next/headers";

const ADMIN_COOKIE = "flyalrafah_admin";

export async function isAdminAuthenticatedServer(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value ?? null;
  return token === "1";
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
}