// app/lib/origin.ts
export function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://ads-flyalrafah.vercel.app";
}