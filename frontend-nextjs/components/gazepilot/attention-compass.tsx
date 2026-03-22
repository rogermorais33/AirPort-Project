"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Radar } from "lucide-react";

import type { AttentionDirection, AttentionSource } from "@/lib/gaze";
import { cn } from "@/lib/utils";

interface AttentionCompassProps {
  direction: AttentionDirection;
  source: AttentionSource;
  intensity: number;
  eyeTrackingActive: boolean;
  confidence: number;
}

const directionCards = [
  { key: "up", label: "Cima", icon: ArrowUp, classes: "left-1/2 top-4 -translate-x-1/2" },
  { key: "right", label: "Direita", icon: ArrowRight, classes: "right-4 top-1/2 -translate-y-1/2" },
  { key: "down", label: "Baixo", icon: ArrowDown, classes: "bottom-4 left-1/2 -translate-x-1/2" },
  { key: "left", label: "Esquerda", icon: ArrowLeft, classes: "left-4 top-1/2 -translate-y-1/2" },
] as const;

export function AttentionCompass({
  direction,
  source,
  intensity,
  eyeTrackingActive,
  confidence,
}: AttentionCompassProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,15,30,0.96),rgba(4,11,18,0.9))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Eye Compass</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {direction === "center" ? "Foco neutro" : `Olhar para ${translateDirection(direction)}`}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-100">
          {eyeTrackingActive ? <Eye className="h-5 w-5" /> : <Radar className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
          fonte: {source === "eye_gaze" ? "íris real" : source === "head_pose" ? "fallback cabeça" : "idle"}
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
          confiança {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="relative mt-6 h-[260px] rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
        <div className="absolute inset-4 rounded-full border border-dashed border-white/10" />
        <div className="absolute inset-[18%] rounded-full border border-white/10" />
        <div className="absolute inset-[32%] rounded-full border border-white/10" />

        {directionCards.map((item) => {
          const Icon = item.icon;
          const active = direction === item.key;

          return (
            <div
              key={item.key}
              className={cn(
                "absolute flex h-16 w-16 items-center justify-center rounded-2xl border text-xs uppercase tracking-[0.2em] transition-all duration-300",
                item.classes,
                active
                  ? "border-cyan-300/80 bg-cyan-300/18 text-cyan-50 shadow-[0_0_35px_rgba(34,211,238,0.28)]"
                  : "border-white/10 bg-white/5 text-white/45",
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}

        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.42),rgba(3,7,18,0.92)_68%)] shadow-[0_0_45px_rgba(56,189,248,0.28)]">
          <div
            className="h-10 w-10 rounded-full bg-white/95 shadow-[0_0_24px_rgba(255,255,255,0.45)] transition-transform duration-300"
            style={{
              transform: `translate(${offsetForDirection(direction).x * intensity * 24}px, ${offsetForDirection(direction).y * intensity * 24}px)`,
            }}
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/45">
          <span>Signal drive</span>
          <span>{Math.round(intensity * 100)}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#34d399,#f59e0b)] transition-all duration-300"
            style={{ width: `${Math.max(8, intensity * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function translateDirection(direction: AttentionDirection): string {
  switch (direction) {
    case "left":
      return "esquerda";
    case "right":
      return "direita";
    case "up":
      return "cima";
    case "down":
      return "baixo";
    default:
      return "centro";
  }
}

function offsetForDirection(direction: AttentionDirection): { x: number; y: number } {
  switch (direction) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    default:
      return { x: 0, y: 0 };
  }
}
