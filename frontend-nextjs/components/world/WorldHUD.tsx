"use client";

import { Activity, Camera, Compass, EyeOff, Gauge, MapPinned, MousePointer2, RotateCcw, type LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import type { TrackingMode } from "@/components/world/world-types";
import { getDistrictById, SKYPORT_DISTRICTS } from "@/lib/world-data";

interface WorldHUDProps {
  trackingMode: TrackingMode;
  motionLatencyMs: number | null;
  openDistrictId: string | null;
}

export function WorldHUD({ trackingMode, motionLatencyMs, openDistrictId }: WorldHUDProps) {
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const playerMotion = useSkyportWorldStore((state) => state.playerMotion);
  const playerHeading = useSkyportWorldStore((state) => state.playerHeading);
  const playerPosition = useSkyportWorldStore((state) => state.playerPosition);
  const nearDistrict = useMemo(() => getDistrictById(nearDistrictId), [nearDistrictId]);
  const openDistrict = useMemo(() => getDistrictById(openDistrictId), [openDistrictId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <HudPill
            icon={trackingMode === "off" ? EyeOff : Activity}
            label="Input"
            value={trackingMode === "local" ? "Browser Cam" : trackingMode === "remote" ? "ESP32 Relay" : "Keyboard"}
          />
          <HudPill icon={Gauge} label="Motion" value={playerMotion} />
          <HudPill icon={Camera} label="Latency" value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`} />
        </div>
        <div className="hidden max-w-md rounded-[24px] border border-white/10 bg-slate-950/58 px-4 py-3 text-right shadow-[0_20px_55px_rgba(2,6,23,0.35)] backdrop-blur-xl md:block">
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/42">GazePilot Skyport</p>
          <p className="mt-1 text-sm text-white/70">Explore first. Enable tracking inside the district that needs it.</p>
        </div>
      </div>

      <div className="absolute left-4 top-20 max-w-sm rounded-[26px] border border-white/10 bg-slate-950/58 p-4 shadow-[0_22px_60px_rgba(2,6,23,0.38)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-cyan-100">
            <MapPinned className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">
              {openDistrict ? "Inside district" : nearDistrict ? "Nearby district" : "Free roam"}
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{openDistrict?.title ?? nearDistrict?.title ?? "Central Skyport"}</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              {openDistrict?.subtitle ??
                nearDistrict?.subtitle ??
                "Follow the lit paths, drag to orbit the camera, and approach a glowing hub to interact."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-white/58">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">WASD / arrows</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Shift sprint</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Drag look</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">Enter interact</span>
        </div>

        {nearDistrict ? (
          <div className="mt-4 rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] px-3 py-2 text-xs uppercase tracking-[0.2em] text-cyan-50">
            Press Enter or blink to open {nearDistrict.signLabel}
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-4 left-4 hidden rounded-[24px] border border-white/10 bg-slate-950/58 p-3 shadow-[0_20px_55px_rgba(2,6,23,0.35)] backdrop-blur-xl lg:block">
        <div className="relative h-36 w-36 rounded-full border border-white/10 bg-white/[0.05]">
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.75)]" />
          <div
            className="absolute left-1/2 top-1/2 h-12 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-cyan-200"
            style={{ transform: `translate(-50%, -100%) rotate(${playerHeading}rad)` }}
          />
          {SKYPORT_DISTRICTS.map((district) => (
            <div
              key={district.id}
              className="absolute h-2.5 w-2.5 rounded-full border border-white/60"
              style={{
                backgroundColor: district.color,
                left: `${50 + district.position[0] * 0.62}%`,
                top: `${50 + district.position[2] * 0.62}%`,
                opacity: district.id === nearDistrictId || district.id === openDistrictId ? 1 : 0.58,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
          <div
            className="absolute h-2 w-2 rounded-full bg-white"
            style={{
              left: `${50 + playerPosition[0] * 0.62}%`,
              top: `${50 + playerPosition[2] * 0.62}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/52">
          <Compass className="h-3.5 w-3.5" />
          minimap
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex max-w-xl flex-wrap justify-end gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
        <ControlChip icon={MousePointer2} value="drag camera" />
        <ControlChip icon={RotateCcw} value="R reset" />
        <ControlChip icon={Compass} value="Q / E orbit" />
      </div>
    </div>
  );
}

function HudPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/62 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70 shadow-[0_12px_38px_rgba(2,6,23,0.25)] backdrop-blur-xl">
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-cyan-100" />
        <span className="text-white/40">{label}</span>
        <span>{value}</span>
      </span>
    </div>
  );
}

function ControlChip({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/58 px-3 py-2 backdrop-blur-xl">
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-cyan-100" />
        {value}
      </span>
    </div>
  );
}
