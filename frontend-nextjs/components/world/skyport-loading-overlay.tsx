"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";

interface SkyportLoadingOverlayProps {
  trackingMode: "off" | "remote" | "local";
  worldReady: boolean;
}

export function SkyportLoadingOverlay({ trackingMode, worldReady }: SkyportLoadingOverlayProps) {
  const { active: assetsActive, progress: assetsProgress } = useProgress();
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const setIntroReady = useSkyportWorldStore((state) => state.setIntroReady);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const normalized = Math.min(100, Math.max(12, Math.round(assetsProgress)));
    if (worldReady && !assetsActive) {
      setProgress(100);
      return;
    }
    setProgress((current) => {
      const target = worldReady ? Math.max(32, normalized) : Math.min(88, normalized);
      if (target <= current) {
        return current;
      }
      return Math.min(100, current + Math.max(1, Math.round((target - current) * 0.3)));
    });
  }, [assetsActive, assetsProgress, worldReady]);

  useEffect(() => {
    if (!worldReady || assetsActive || progress < 100) {
      return;
    }
    const id = window.setTimeout(() => {
      setIntroReady(true);
    }, 360);
    return () => {
      window.clearTimeout(id);
    };
  }, [assetsActive, progress, setIntroReady, worldReady]);

  if (introReady) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(8,15,32,0.98))]">
      <div className="w-full max-w-lg px-6">
        <div className="rounded-[32px] border border-white/10 bg-slate-950/72 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100/55">Skyport World / venues loading</p>
          <h2 className="mt-3 font-heading text-3xl text-white">Docking into the world...</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">
            preparando mapa, personagem, lugares interativos e camada opcional de eye tracking
          </p>

          <div className="mt-6 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            <div
              className="h-3 rounded-full bg-[linear-gradient(90deg,#67e8f9,#60a5fa,#f59e0b)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/52">
            <span>{progress}% synced</span>
            <span>
              {assetsActive
                ? "loading assets"
                : trackingMode === "local"
                  ? "browser cam active"
                  : trackingMode === "remote"
                    ? "esp32 relay active"
                    : "keyboard roaming"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
