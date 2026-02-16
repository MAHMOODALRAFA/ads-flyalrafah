import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlyAlrafah",
  description: "FlyAlrafah Referral Campaign",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabicFont.variable} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
