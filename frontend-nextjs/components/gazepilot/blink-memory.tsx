"use client";

import { EyeOff, TimerReset, Zap } from "lucide-react";

import { formatShortTime } from "@/lib/format";

interface BlinkMemoryProps {
  blinkCount: number;
  lastBlinkAt: string | null;
  blinkActive: boolean;
  motionLatencyMs: number | null;
  processingLatencyMs: number | null;
  framesProcessed: number;
}

const scenes = [
  {
    title: "Orbit Garden",
    accent: "from-cyan-300/25 via-sky-400/10 to-transparent",
    glow: "bg-cyan-300/25",
    caption: "pisque para trocar de universo",
  },
  {
    title: "Metro Drift",
    accent: "from-amber-300/20 via-orange-400/10 to-transparent",
    glow: "bg-amber-300/25",
    caption: "uma piscada colapsa a próxima cena",
  },
  {
    title: "Cloud Harbor",
    accent: "from-emerald-300/22 via-teal-300/10 to-transparent",
    glow: "bg-emerald-300/25",
    caption: "teste se o blink vem sem atraso",
  },
  {
    title: "Neon Reef",
    accent: "from-fuchsia-300/20 via-pink-400/10 to-transparent",
    glow: "bg-fuchsia-300/25",
    caption: "ideal para validar Before Your Eyes vibes",
  },
];

export function BlinkMemory({
  blinkCount,
  lastBlinkAt,
  blinkActive,
  motionLatencyMs,
  processingLatencyMs,
  framesProcessed,
}: BlinkMemoryProps) {
  const scene = scenes[blinkCount % scenes.length] ?? scenes[0];
  const speedLabel = motionLatencyMs === null ? "aguardando" : motionLatencyMs < 240 ? "natural" : motionLatencyMs < 420 ? "jogável" : "lento";

  return (
    <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(12,18,30,0.96),rgba(18,10,26,0.94))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.38)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">Blink Memory</p>
          <p className="mt-2 text-2xl font-semibold text-white">Validador de piscada em tempo real</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white/75">
          {blinkActive ? <EyeOff className="h-5 w-5 text-amber-100" /> : <Zap className="h-5 w-5 text-cyan-100" />}
        </div>
      </div>

      <div className={`relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br ${scene.accent} p-5`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.05),rgba(2,6,23,0.4))]" />
        <div className={`absolute left-8 top-8 h-28 w-28 rounded-full blur-3xl ${scene.glow}`} />
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Current scene</p>
          <p className="mt-2 text-4xl font-semibold text-white">{scene.title}</p>
          <p className="mt-3 text-base text-white/70">{scene.caption}</p>
        </div>

        <div className="relative z-10 mt-20 grid gap-3 md:grid-cols-3">
          <MetricCard label="Blinks" value={String(blinkCount)} />
          <MetricCard label="Motion-to-screen" value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`} />
          <MetricCard label="Backend proc" value={processingLatencyMs === null ? "--" : `${Math.round(processingLatencyMs)} ms`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <StatusPill label="status" value={blinkActive ? "blink detectado" : "olhos abertos"} />
        <StatusPill label="última piscada" value={lastBlinkAt ? formatShortTime(lastBlinkAt) : "--"} />
        <StatusPill label="feel" value={speedLabel} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70">
        <span className="flex items-center gap-2">
          <TimerReset className="h-4 w-4" />
          frames processados {framesProcessed}
        </span>
        <span>se o motion-to-screen subir muito, o gargalo costuma ser rede remota/https</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-base text-white">{value}</p>
    </div>
  );
}
