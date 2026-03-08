import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const headingFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "GazePilot Dashboard",
  description: "ESP32-CAM gaze/head tracking live dashboard with heatmaps and commands",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-zinc-950 text-zinc-100`}>
        <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/live" className="font-heading text-xl font-semibold tracking-tight text-emerald-300">
              GazePilot
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-300">
              <Link href="/live" className="hover:text-emerald-300">
                Live
              </Link>
              <Link href="/calibration" className="hover:text-emerald-300">
                Calibration
              </Link>
              <Link href="/sessions" className="hover:text-emerald-300">
                Sessions
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
