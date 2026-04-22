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
  title: "GazePilot",
  description: "Mundo 3D, control room e experiencias hands-free com Browser Cam e ESP32-CAM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-zinc-950 text-zinc-100`}>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/58 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#67e8f9,rgba(15,23,42,0.92)_68%)] text-sm font-semibold text-slate-950 shadow-[0_0_32px_rgba(103,232,249,0.24)]">
                GP
              </span>
              <div>
                <span className="font-heading text-xl font-semibold tracking-tight text-white">GazePilot</span>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">dream expo city / control room</p>
              </div>
            </Link>
            <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm text-zinc-300">
              <Link href="/" className="rounded-full px-4 py-2 transition hover:bg-cyan-300/10 hover:text-cyan-100">
                Home
              </Link>
              <Link href="/live" className="rounded-full px-4 py-2 transition hover:bg-cyan-300/10 hover:text-cyan-100">
                Live
              </Link>
              <Link
                href="/calibration"
                className="rounded-full px-4 py-2 transition hover:bg-cyan-300/10 hover:text-cyan-100"
              >
                Calibration
              </Link>
              <Link href="/world" className="rounded-full px-4 py-2 transition hover:bg-cyan-300/10 hover:text-cyan-100">
                World
              </Link>
              <Link href="/sessions" className="rounded-full px-4 py-2 transition hover:bg-cyan-300/10 hover:text-cyan-100">
                Sessions
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8">{children}</main>
      </body>
    </html>
  );
}
