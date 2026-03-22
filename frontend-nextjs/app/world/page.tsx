"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Camera, Orbit, Sparkles, TimerReset } from "lucide-react";

import { AttentionCompass } from "@/components/gazepilot/attention-compass";
import { BlinkMemory } from "@/components/gazepilot/blink-memory";
import { CommandLog } from "@/components/gazepilot/command-log";
import { GazeArcade } from "@/components/gazepilot/gaze-arcade";
import { GazeOverlay } from "@/components/gazepilot/gaze-overlay";
import { LivePreview } from "@/components/gazepilot/live-preview";
import { LocalTrackingPreview } from "@/components/gazepilot/local-tracking-preview";
import { WorldExpoScene, type ExpoBooth } from "@/components/gazepilot/world-expo-scene";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLocalEyeTracking } from "@/hooks/use-local-eye-tracking";
import { heartbeatDevice, getActiveSession } from "@/lib/api";
import { deriveAttentionState, type AttentionDirection } from "@/lib/gaze";
import type { CommandEvent, Device, Session } from "@/lib/types";
import { getDistrictActionByIndex, getDistrictById } from "@/lib/world-data";

const DEVICE_STORAGE_KEY = "gazepilot-device-v1";
const SESSION_STORAGE_KEY = "gazepilot-session-v1";
const YAW_THRESHOLD = 20;
const PITCH_THRESHOLD = 15;

const BOOTHS: ExpoBooth[] = [
  {
    id: "blink-theater",
    title: "Blink Theater",
    subtitle: "before your eyes vibes",
    color: "#f59e0b",
    position: [-8, 0, -7],
    lane: 0,
    row: 0,
  },
  {
    id: "arcade-bay",
    title: "Arcade Bay",
    subtitle: "gaze-driven micro game",
    color: "#d946ef",
    position: [0, 0, -7],
    lane: 1,
    row: 0,
  },
  {
    id: "signal-observatory",
    title: "Signal Observatory",
    subtitle: "see direction and source",
    color: "#22d3ee",
    position: [8, 0, -7],
    lane: 2,
    row: 0,
  },
  {
    id: "vision-dock",
    title: "Vision Dock",
    subtitle: "preview + raw gaze",
    color: "#34d399",
    position: [-8, 0, 7],
    lane: 0,
    row: 1,
  },
  {
    id: "command-cafe",
    title: "Command Cafe",
    subtitle: "command stream lounge",
    color: "#60a5fa",
    position: [0, 0, 7],
    lane: 1,
    row: 1,
  },
  {
    id: "latency-lab",
    title: "Latency Lab",
    subtitle: "feel the pipeline speed",
    color: "#f472b6",
    position: [8, 0, 7],
    lane: 2,
    row: 1,
  },
];

type TrackingMode = "remote" | "local";
type WorldMode = "roam" | "expo";

const SkyportWorldScene = dynamic(
  () => import("@/components/world/skyport-world-scene").then((module) => module.SkyportWorldScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[720px] items-center justify-center rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(10,12,32,0.93))] text-sm uppercase tracking-[0.22em] text-white/55">
        loading skyport scene
      </div>
    ),
  },
);

export default function WorldPage() {
  const [device, setDevice] = useState<Device | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [neutralPose, setNeutralPose] = useState<{ yaw: number; pitch: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState({ lane: 1, row: 0 });
  const [openBoothId, setOpenBoothId] = useState<string | null>(null);
  const [worldMode, setWorldMode] = useState<WorldMode>("roam");
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("local");
  const [worldCommands, setWorldCommands] = useState<CommandEvent[]>([]);
  const [lastInteraction, setLastInteraction] = useState<{
    districtId: string;
    actionId: string;
    actionLabel: string;
    source: string;
  } | null>(null);

  const navStateRef = useRef<{ direction: AttentionDirection; startedAt: number | null; lastCommitAt: number }>({
    direction: "center",
    startedAt: null,
    lastCommitAt: 0,
  });
  const expoBlinkRef = useRef(0);
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const selectedActionIndex = useSkyportWorldStore((state) => state.selectedActionIndex);
  const selectedActionSource = useSkyportWorldStore((state) => state.selectedActionSource);

  const remoteData = useDashboardData(session?.id ?? null);
  const localData = useLocalEyeTracking(trackingMode === "local");

  useEffect(() => {
    const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedDevice) {
      try {
        const parsed = JSON.parse(storedDevice) as Device;
        setDevice(parsed);
      } catch {
        localStorage.removeItem(DEVICE_STORAGE_KEY);
      }
    }
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as Session;
        setSession(parsed);
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!device || session) {
      return;
    }

    getActiveSession(device.id)
      .then((active) => {
        setSession(active);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(active));
      })
      .catch(() => {
        // World keeps working in browser-cam mode.
      });
  }, [device, session]);

  useEffect(() => {
    if (!device || trackingMode !== "remote") {
      return;
    }

    const interval = window.setInterval(() => {
      void heartbeatDevice({
        device_id: device.id,
        device_key: device.device_key,
        fw_version: device.fw_version,
      }).catch(() => {
        // Latency is surfaced in the HUD.
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [device, trackingMode]);

  const activeFaceMetrics = trackingMode === "local" ? localData.faceMetrics : remoteData.faceMetrics;
  const activeGazePoint = trackingMode === "local" ? localData.gazePoint : remoteData.gazePoint;
  const activeLastFrame = trackingMode === "local" ? localData.lastFrame : remoteData.lastFrame;
  const activePose = trackingMode === "local" ? localData.pose : remoteData.pose;
  const blinkCount = trackingMode === "local" ? localData.blinkCount : remoteData.blinkCount;
  const lastBlinkAt = trackingMode === "local" ? localData.lastBlinkAt : remoteData.lastBlinkAt;
  const framesProcessed = trackingMode === "local" ? localData.framesProcessed : remoteData.framesProcessed;
  const wsStatus = trackingMode === "local" ? localData.wsStatus : remoteData.wsStatus;
  const lastError = trackingMode === "local" ? localData.lastError : remoteData.lastError;
  const motionLatencyMs =
    trackingMode === "local" ? localData.processingLatencyMs ?? activeLastFrame?.age_ms ?? null : activeLastFrame?.age_ms ?? null;
  const processingLatencyMs =
    trackingMode === "local"
      ? localData.processingLatencyMs ?? activeLastFrame?.latency_ms ?? null
      : activeLastFrame?.latency_ms ?? null;

  useEffect(() => {
    setNeutralPose(null);
  }, [trackingMode, session?.id]);

  useEffect(() => {
    if (!activePose.faceDetected) {
      return;
    }

    setNeutralPose((current) => {
      if (!current) {
        return { yaw: activePose.yaw, pitch: activePose.pitch };
      }

      const nearNeutral =
        Math.abs(activePose.yaw - current.yaw) < YAW_THRESHOLD * 0.7 &&
        Math.abs(activePose.pitch - current.pitch) < PITCH_THRESHOLD * 0.7;
      if (!nearNeutral) {
        return current;
      }

      return {
        yaw: current.yaw * 0.98 + activePose.yaw * 0.02,
        pitch: current.pitch * 0.98 + activePose.pitch * 0.02,
      };
    });
  }, [activePose.faceDetected, activePose.pitch, activePose.yaw]);

  const centeredYaw = activePose.yaw - (neutralPose?.yaw ?? 0);
  const centeredPitch = activePose.pitch - (neutralPose?.pitch ?? 0);
  const attentionState = useMemo(
    () =>
      deriveAttentionState({
        faceMetrics: activeFaceMetrics,
        centeredYaw,
        centeredPitch,
      }),
    [activeFaceMetrics, centeredPitch, centeredYaw],
  );

  const selectedBooth = useMemo(
    () => BOOTHS.find((item) => item.lane === selectedCoords.lane && item.row === selectedCoords.row) ?? BOOTHS[0],
    [selectedCoords.lane, selectedCoords.row],
  );
  const openBooth = useMemo(() => BOOTHS.find((item) => item.id === openBoothId) ?? null, [openBoothId]);
  const focusedDistrict = useMemo(() => getDistrictById(nearDistrictId), [nearDistrictId]);
  const openDistrict = useMemo(() => getDistrictById(openBoothId), [openBoothId]);
  const targetDistrict = useMemo(
    () => (worldMode === "roam" ? openDistrict ?? focusedDistrict : getDistrictById(selectedBooth.id)),
    [focusedDistrict, openDistrict, selectedBooth.id, worldMode],
  );
  const targetBoothId = targetDistrict?.boothId ?? (worldMode === "roam" ? "signal-observatory" : selectedBooth.id);
  const selectedDistrictAction = useMemo(
    () => getDistrictActionByIndex(targetDistrict?.id, selectedActionIndex),
    [selectedActionIndex, targetDistrict?.id],
  );

  const openBoothFromInteraction = useCallback((boothId: string, source: string) => {
    const booth = BOOTHS.find((item) => item.id === boothId);
    if (!booth) {
      return;
    }

    setOpenBoothId(booth.id);
    setStatusMessage(`${booth.title} aberto via ${source}`);
  }, []);

  const handleWorldInteractionCommit = useCallback(
    (payload: {
      districtId: string;
      actionId: string;
      actionLabel: string;
      source: "blink" | "keyboard";
    }) => {
      const district = getDistrictById(payload.districtId);
      if (!district) {
        return;
      }

      setLastInteraction({
        districtId: payload.districtId,
        actionId: payload.actionId,
        actionLabel: payload.actionLabel,
        source: payload.source,
      });

      if (payload.actionId === "story") {
        setOpenBoothId(null);
        setStatusMessage(`${district.title}: ${district.lore}`);
      } else {
        openBoothFromInteraction(district.boothId, `${payload.actionLabel.toLowerCase()} / ${payload.source}`);
      }

      pushLocalCommand(setWorldCommands, {
        command: payload.actionId === "enter" ? "DISTRICT_ENTER" : payload.actionId === "story" ? "DISTRICT_LORE" : "DISTRICT_CHALLENGE",
        confidence: 0.98,
        trigger: payload.source,
        source: trackingMode === "local" ? "browser_cam" : "esp32_backend",
        meta_json: {
          district_id: payload.districtId,
          action_id: payload.actionId,
          action_label: payload.actionLabel,
          tracking_mode: trackingMode,
        },
      });
    },
    [openBoothFromInteraction, trackingMode],
  );

  useEffect(() => {
    if (worldMode !== "expo") {
      return;
    }

    const now = Date.now();
    const state = navStateRef.current;
    const direction = attentionState.direction;
    const strongEnough = attentionState.intensity >= 0.44;

    if (direction === "center" || !strongEnough) {
      state.direction = "center";
      state.startedAt = null;
      return;
    }

    if (state.direction !== direction) {
      state.direction = direction;
      state.startedAt = now;
      return;
    }

    if (state.startedAt === null) {
      state.startedAt = now;
      return;
    }

    if (now - state.startedAt < 360 || now - state.lastCommitAt < 620) {
      return;
    }

    setSelectedCoords((current) => {
      if (direction === "left") {
        return { ...current, lane: Math.max(0, current.lane - 1) };
      }
      if (direction === "right") {
        return { ...current, lane: Math.min(2, current.lane + 1) };
      }
      if (direction === "up") {
        return { ...current, row: Math.max(0, current.row - 1) };
      }
      if (direction === "down") {
        return { ...current, row: Math.min(1, current.row + 1) };
      }
      return current;
    });
    state.lastCommitAt = now;
    state.startedAt = now;
  }, [attentionState.direction, attentionState.intensity, worldMode]);

  useEffect(() => {
    if (worldMode !== "expo") {
      return;
    }
    if (blinkCount <= expoBlinkRef.current) {
      return;
    }
    expoBlinkRef.current = blinkCount;
    openBoothFromInteraction(selectedBooth.id, "blink");
  }, [blinkCount, openBoothFromInteraction, selectedBooth.id, worldMode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (worldMode === "expo") {
        if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
          setSelectedCoords((current) => ({ ...current, lane: Math.max(0, current.lane - 1) }));
        } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
          setSelectedCoords((current) => ({ ...current, lane: Math.min(2, current.lane + 1) }));
        } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
          setSelectedCoords((current) => ({ ...current, row: Math.max(0, current.row - 1) }));
        } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
          setSelectedCoords((current) => ({ ...current, row: Math.min(1, current.row + 1) }));
        } else if (event.key === "Enter" || event.key === " ") {
          openBoothFromInteraction(selectedBooth.id, "teclado");
        }
      }

      if (event.key === "Escape") {
        setOpenBoothId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openBoothFromInteraction, selectedBooth.id, worldMode]);

  const commands = useMemo(() => {
    if (trackingMode === "local") {
      return worldCommands;
    }
    return [...worldCommands, ...remoteData.commands].sort((left, right) => {
      const leftTs = left.ts ? Date.parse(left.ts) : 0;
      const rightTs = right.ts ? Date.parse(right.ts) : 0;
      return rightTs - leftTs;
    });
  }, [remoteData.commands, trackingMode, worldCommands]);

  const overlayPoint = useMemo(() => {
    if (!activeGazePoint) {
      return { x: null as number | null, y: null as number | null };
    }
    if (trackingMode === "remote" && session?.screen_w && session.screen_h) {
      return {
        x: (activeGazePoint.x / session.screen_w) * 360,
        y: (activeGazePoint.y / session.screen_h) * 180,
      };
    }
    if (activeGazePoint.x >= 0 && activeGazePoint.x <= 1 && activeGazePoint.y >= 0 && activeGazePoint.y <= 1) {
      return { x: activeGazePoint.x * 360, y: activeGazePoint.y * 180 };
    }
    return { x: activeGazePoint.x, y: activeGazePoint.y };
  }, [activeGazePoint, session, trackingMode]);

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(5,12,24,0.95),rgba(12,10,28,0.94)_52%,rgba(8,23,34,0.92))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.42)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">World Phase 2</p>
            <h1 className="mt-3 font-heading text-4xl leading-tight text-white md:text-5xl">
              Mundo 3D com free roam, browser cam local e distritos interativos para o GazePilot.
            </h1>
            <p className="mt-4 text-base leading-7 text-white/68">
              O modo <span className="text-white">free roam</span> foi pensado para navegar de verdade. Para a
              sensacao ficar natural, o melhor input agora e o <span className="text-white">browser cam</span>, que
              tira o salto de rede do meio do caminho. O modo ESP32 continua aqui para comparar e validar o pipeline
              completo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <TopPill label={`${wsStatus}`} icon={Activity} />
            <TopPill label={attentionState.eyeTrackingActive ? "iris ativa" : "fallback pose"} icon={Sparkles} />
            <TopPill label={activePose.faceDetected ? "face on" : "face off"} icon={Camera} />
            <TopPill label={`${worldMode}`} icon={Orbit} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Control Mode</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SegmentButton
                active={worldMode === "roam"}
                label="Free Roam"
                onClick={() => {
                  setWorldMode("roam");
                  setStatusMessage("Modo livre ativo.");
                }}
              />
              <SegmentButton
                active={worldMode === "expo"}
                label="Expo Grid"
                onClick={() => {
                  setWorldMode("expo");
                  setStatusMessage("Modo expo ativo.");
                }}
              />
            </div>

            <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-white/45">Input Source</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SegmentButton
                active={trackingMode === "local"}
                label="Browser Cam"
                onClick={() => {
                  setTrackingMode("local");
                  setStatusMessage("Tracking local ativado. Preview completo no Vision Dock.");
                }}
              />
              <SegmentButton
                active={trackingMode === "remote"}
                label="ESP32 / Backend"
                onClick={() => {
                  setTrackingMode("remote");
                  setStatusMessage("Tracking remoto ativado.");
                }}
              />
              {trackingMode === "local" ? (
                <SegmentButton
                  active={false}
                  label="Recenter"
                  onClick={() => {
                    localData.recenter();
                    setStatusMessage("Centro local atualizado.");
                  }}
                />
              ) : null}
              {trackingMode === "local" && (localData.localStatus === "blocked" || localData.localStatus === "error") ? (
                <SegmentButton
                  active={false}
                  label="Retry Cam"
                  onClick={() => {
                    localData.retry();
                    setStatusMessage("Tentando reiniciar a Browser Cam.");
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Quick Flow</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <BoothStat label="Motion-to-screen" value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`} />
              <BoothStat label="Proc" value={processingLatencyMs === null ? "--" : `${Math.round(processingLatencyMs)} ms`} />
              <BoothStat label="Blinks" value={String(blinkCount)} />
              <BoothStat label="Frames" value={String(framesProcessed)} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/live"
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/12 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
          >
            Abrir Control Room
          </Link>
          <button
            type="button"
            onClick={() => {
              if (targetDistrict) {
                openBoothFromInteraction(targetDistrict.boothId, "painel");
              }
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
          >
            Entrar no distrito atual
          </button>
          <button
            type="button"
            onClick={() => setOpenBoothId(null)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
          >
            Fechar distrito
          </button>
        </div>

        {statusMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}

        {lastError ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {lastError}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        {worldMode === "roam" ? (
          <SkyportWorldScene
            trackingMode={trackingMode}
            attentionSource={attentionState.source}
            attentionIntensity={attentionState.intensity}
            attentionRawX={attentionState.rawX}
            attentionRawY={attentionState.rawY}
            eyeTrackingActive={attentionState.eyeTrackingActive}
            blinkPulse={blinkCount}
            motionLatencyMs={motionLatencyMs}
            openDistrictId={openBoothId}
            onCommitInteraction={handleWorldInteractionCommit}
          />
        ) : (
          <WorldExpoScene
            booths={BOOTHS}
            selectedBoothId={selectedBooth.id}
            openBoothId={openBoothId}
            attentionDirection={attentionState.direction}
            wsStatus={wsStatus}
            motionLatencyMs={motionLatencyMs}
          />
        )}

        <div className="glass-panel flex min-h-[780px] flex-col rounded-[32px] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Current District</p>
              <p className="mt-2 text-3xl font-semibold text-white">{targetDistrict?.title ?? "Signal Drift"}</p>
              <p className="mt-2 text-sm text-white/60">{targetDistrict?.subtitle ?? "Olhe ao redor para focar um distrito."}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70">
              {openBooth ? "ativo" : worldMode === "roam" ? "proximidade" : "alvo"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <BoothStat label="Mode" value={worldMode.toUpperCase()} />
            <BoothStat label="Input" value={trackingMode === "local" ? "BROWSER CAM" : "ESP32"} />
            <BoothStat label="Direction" value={attentionState.direction.toUpperCase()} />
            <BoothStat label="Drive" value={`${Math.round(attentionState.intensity * 100)}%`} />
          </div>

          {worldMode === "roam" ? (
            <div className="mt-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Context Action</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedDistrictAction?.label ?? "Aproxime de um distrito"}
                  </p>
                  <p className="mt-2 text-sm text-white/62">
                    {selectedDistrictAction?.description ?? "Use o olhar para trocar entre os slots 01, 02 e 03."}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/68">
                  {selectedActionSource}
                </div>
              </div>

              {targetDistrict ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {targetDistrict.actions.map((action, index) => (
                    <div
                      key={action.id}
                      className={
                        selectedDistrictAction?.id === action.id
                          ? "rounded-[22px] border border-cyan-300/35 bg-cyan-300/12 px-4 py-3 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                          : "rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-white/72"
                      }
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">slot 0{index + 1}</p>
                      <p className="mt-2 text-sm font-semibold">{action.label}</p>
                      <p className="mt-2 text-xs leading-5 text-white/56">{action.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {lastInteraction ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  ultimo commit: {lastInteraction.actionLabel} em {getDistrictById(lastInteraction.districtId)?.title} via {lastInteraction.source}
                </div>
              ) : null}

              {targetDistrict ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/62">
                  {targetDistrict.lore}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            {renderBoothContent({
              boothId: targetBoothId,
              trackingMode,
              sessionId: trackingMode === "remote" ? session?.id ?? null : null,
              previewStream: localData.previewStream,
              localStatus: localData.localStatus,
              localError: localData.lastError,
              localFps: localData.localFps,
              retryLocalCamera: localData.retry,
              pose: activePose,
              centeredYaw,
              centeredPitch,
              attentionState,
              faceMetrics: activeFaceMetrics,
              gazePoint: activeGazePoint,
              overlayPoint,
              lastFrameAgeMs: motionLatencyMs,
              lastFrameLatencyMs: processingLatencyMs,
              blinkCount,
              lastBlinkAt,
              framesProcessed,
              commands,
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function renderBoothContent(input: {
  boothId: string;
  trackingMode: TrackingMode;
  sessionId: string | null;
  previewStream: MediaStream | null;
  localStatus: "idle" | "loading" | "ready" | "blocked" | "error";
  localError: string | null;
  localFps: number | null;
  retryLocalCamera: () => void;
  pose: { yaw: number; pitch: number; roll: number; confidence: number; faceDetected: boolean; backend: string };
  centeredYaw: number;
  centeredPitch: number;
  attentionState: ReturnType<typeof deriveAttentionState>;
  faceMetrics: ReturnType<typeof useDashboardData>["faceMetrics"];
  gazePoint: ReturnType<typeof useDashboardData>["gazePoint"];
  overlayPoint: { x: number | null; y: number | null };
  lastFrameAgeMs: number | null;
  lastFrameLatencyMs: number | null;
  blinkCount: number;
  lastBlinkAt: string | null;
  framesProcessed: number;
  commands: CommandEvent[];
}) {
  switch (input.boothId) {
    case "blink-theater":
      return (
        <BlinkMemory
          blinkCount={input.blinkCount}
          lastBlinkAt={input.lastBlinkAt}
          blinkActive={Boolean(input.faceMetrics?.blink)}
          motionLatencyMs={input.lastFrameAgeMs}
          processingLatencyMs={input.lastFrameLatencyMs}
          framesProcessed={input.framesProcessed}
        />
      );
    case "arcade-bay":
      return (
        <GazeArcade
          direction={input.attentionState.direction}
          source={input.attentionState.source}
          signalStrength={input.attentionState.intensity}
          active={input.pose.faceDetected}
        />
      );
    case "signal-observatory":
      return (
        <AttentionCompass
          direction={input.attentionState.direction}
          source={input.attentionState.source}
          intensity={input.attentionState.intensity}
          eyeTrackingActive={input.attentionState.eyeTrackingActive}
          confidence={input.gazePoint?.confidence ?? input.pose.confidence}
        />
      );
    case "vision-dock":
      return (
        <div className="space-y-4">
          {input.trackingMode === "local" ? (
            <LocalTrackingPreview
              stream={input.previewStream}
              width={720}
              height={420}
              status={input.localStatus}
              error={input.localError}
              onRetry={input.retryLocalCamera}
              faceDetected={input.pose.faceDetected}
              attentionDirection={input.attentionState.direction}
              attentionSource={input.attentionState.source}
              gazeRawX={input.attentionState.rawX}
              gazeRawY={input.attentionState.rawY}
              faceXNorm={typeof input.faceMetrics?.features?.face_x_norm === "number" ? input.faceMetrics.features.face_x_norm : null}
              faceYNorm={typeof input.faceMetrics?.features?.face_y_norm === "number" ? input.faceMetrics.features.face_y_norm : null}
              fps={input.localFps}
              processingLatencyMs={input.lastFrameLatencyMs}
            />
          ) : (
            <LivePreview
              sessionId={input.sessionId}
              width={720}
              height={420}
              yaw={input.centeredYaw}
              pitch={input.centeredPitch}
              roll={input.pose.roll}
              faceDetected={input.pose.faceDetected}
              suggestedAction={null}
              attentionDirection={input.attentionState.direction}
              attentionSource={input.attentionState.source}
              gazeRawX={input.attentionState.rawX}
              gazeRawY={input.attentionState.rawY}
              faceXNorm={typeof input.faceMetrics?.features?.face_x_norm === "number" ? input.faceMetrics.features.face_x_norm : null}
              faceYNorm={typeof input.faceMetrics?.features?.face_y_norm === "number" ? input.faceMetrics.features.face_y_norm : null}
            />
          )}
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">raw gaze map</p>
            <div className="mt-4">
              <GazeOverlay
                width={360}
                height={180}
                x={input.overlayPoint.x}
                y={input.overlayPoint.y}
                confidence={input.gazePoint?.confidence ?? 0}
              />
            </div>
          </div>
        </div>
      );
    case "command-cafe":
      return (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">last cues</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <BoothStat label="tracking" value={input.attentionState.source === "eye_gaze" ? "IRIS" : "POSE"} />
              <BoothStat label="direction" value={input.attentionState.direction.toUpperCase()} />
            </div>
          </div>
          <div className="h-[420px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
            <CommandLog commands={input.commands} />
          </div>
        </div>
      );
    case "latency-lab":
      return (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Latency Lab</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {input.lastFrameAgeMs === null ? "--" : `${Math.round(input.lastFrameAgeMs)} ms`}
            </p>
            <p className="mt-2 text-white/65">tempo entre frame util e resposta percebida no mundo</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AdviceCard title="Para free roam" body="browser cam local e o modo mais plausivel para locomocao continua agora." />
            <AdviceCard title="Pipeline completo" body="ESP32 continua util para demo real do hardware, booths e validacao end-to-end." />
            <AdviceCard title="Quando usar LAN" body="se quiser insistir no ESP32 para navegar, backend local via http://IP_LOCAL:8000 e o minimo aceitavel." />
            <AdviceCard title="Proxima otimização" body="worker dedicado ou webcam local com tarefas WASM fora da UI principal." />
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-5">
            <p className="flex items-center gap-2 text-white/75">
              <TimerReset className="h-4 w-4" />
              backend/local proc {input.lastFrameLatencyMs === null ? "--" : `${Math.round(input.lastFrameLatencyMs)} ms`}
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function TopPill({
  label,
  icon: Icon,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/70">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function BoothStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function AdviceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
    </div>
  );
}

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-cyan-300/30 bg-cyan-300/14 px-4 py-2 text-sm font-medium text-cyan-50 transition"
          : "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/[0.08]"
      }
    >
      {label}
    </button>
  );
}

function pushLocalCommand(
  setter: Dispatch<SetStateAction<CommandEvent[]>>,
  command: Omit<CommandEvent, "cooldown_ms" | "ts">,
) {
  setter((current) => [
    {
      ...command,
      cooldown_ms: 0,
      ts: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 40));
}
