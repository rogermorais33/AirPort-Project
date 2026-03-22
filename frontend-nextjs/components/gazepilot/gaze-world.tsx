"use client";

import { Command, Sparkles } from "lucide-react";

import type { AttentionDirection, AttentionSource } from "@/lib/gaze";
import { cn } from "@/lib/utils";

interface GazeWorldProps {
  direction: AttentionDirection;
  source: AttentionSource;
  pointerX: number;
  pointerY: number;
  latestCommand: string | null;
  wsStatus: string;
}

const islands = [
  { key: "up", label: "North Lift", x: 50, y: 14 },
  { key: "right", label: "East Run", x: 84, y: 44 },
  { key: "down", label: "South Loop", x: 52, y: 79 },
  { key: "left", label: "West Dock", x: 16, y: 48 },
] as const;

export function GazeWorld({ direction, source, pointerX, pointerY, latestCommand, wsStatus }: GazeWorldProps) {
  const clampedX = Math.max(0.08, Math.min(0.92, pointerX || 0.5));
  const clampedY = Math.max(0.08, Math.min(0.92, pointerY || 0.5));
  const driftX = (clampedX - 0.5) * 24;
  const driftY = (clampedY - 0.5) * 18;

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,20,33,0.96),rgba(4,9,19,0.94))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Terminalverse</p>
          <p className="mt-2 text-2xl font-semibold text-white">Mundo reativo ao olhar</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          ws {wsStatus}
        </div>
      </div>

      <div className="relative mt-5 h-[320px] [perspective:1200px]">
        <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_35%)]" />
        <div
          className="absolute inset-5 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(10,17,30,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform duration-300"
          style={{
            transform: `rotateX(68deg) rotateZ(-18deg) translate3d(${driftX}px, ${driftY}px, 0px)`,
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.04)_1px),linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_1px)] bg-[size:36px_36px]" />
          <div className="absolute left-[14%] top-[18%] h-24 w-24 rounded-full bg-cyan-400/14 blur-3xl" />
          <div className="absolute right-[16%] top-[50%] h-24 w-24 rounded-full bg-emerald-400/14 blur-3xl" />
          <div className="absolute bottom-[12%] left-[42%] h-20 w-20 rounded-full bg-amber-300/16 blur-3xl" />

          {islands.map((island) => {
            const active = direction === island.key;
            return (
              <div
                key={island.label}
                className={cn(
                  "absolute flex min-w-28 -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border px-3 py-2 text-left transition-all duration-300",
                  active
                    ? "border-cyan-300/60 bg-cyan-300/18 text-cyan-50 shadow-[0_0_28px_rgba(103,232,249,0.22)]"
                    : "border-white/10 bg-white/[0.06] text-white/[0.65]",
                )}
                style={{ left: `${island.x}%`, top: `${island.y}%` }}
              >
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">zone</span>
                <span className="mt-1 text-sm font-medium">{island.label}</span>
              </div>
            );
          })}
        </div>

        <div
          className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/40 bg-cyan-200/12 shadow-[0_0_36px_rgba(103,232,249,0.28)] transition-all duration-300"
          style={{ left: `${clampedX * 100}%`, top: `${clampedY * 100}%` }}
        >
          <div className="absolute inset-2 rounded-full border border-white/30" />
          <div className="absolute inset-5 rounded-full bg-white/95" />
        </div>

        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.44),rgba(3,7,18,0.92)_70%)] text-white shadow-[0_0_40px_rgba(16,185,129,0.28)]">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">guidance mode</p>
          <p className="mt-2 text-base text-white">{source === "eye_gaze" ? "Navegando com íris" : "Fallback por pose"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/45">
            <Command className="h-3.5 w-3.5" />
            latest
          </p>
          <p className="mt-2 text-base text-white">{latestCommand ?? "aguardando comando"}</p>
        </div>
      </div>
    </div>
  );
}
