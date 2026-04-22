"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Camera, EyeOff, Gamepad2, MapPinned, Sparkles, TimerReset } from "lucide-react";

import { AttentionCompass } from "@/components/gazepilot/attention-compass";
import { BlinkMemory } from "@/components/gazepilot/blink-memory";
import { CommandLog } from "@/components/gazepilot/command-log";
import { GazeArcade } from "@/components/gazepilot/gaze-arcade";
import { GazeOverlay } from "@/components/gazepilot/gaze-overlay";
import { LivePreview } from "@/components/gazepilot/live-preview";
import { LocalTrackingPreview } from "@/components/gazepilot/local-tracking-preview";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLocalEyeTracking } from "@/hooks/use-local-eye-tracking";
import { heartbeatDevice, getActiveSession } from "@/lib/api";
import { deriveAttentionState, type AttentionDirection } from "@/lib/gaze";
import type { CommandEvent, Device, Session } from "@/lib/types";
import { getDistrictActionByIndex, getDistrictById, SKYPORT_DISTRICTS, type WorldDistrict } from "@/lib/world-data";

const DEVICE_STORAGE_KEY = "gazepilot-device-v1";
const SESSION_STORAGE_KEY = "gazepilot-session-v1";
const YAW_THRESHOLD = 20;
const PITCH_THRESHOLD = 15;

type TrackingMode = "off" | "remote" | "local";

const IDLE_POSE = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  confidence: 0,
  faceDetected: false,
  backend: "manual",
};

const IDLE_ATTENTION_STATE = {
  direction: "center" as AttentionDirection,
  source: "idle" as const,
  intensity: 0,
  rawX: 0.5,
  rawY: 0.5,
  eyeTrackingActive: false,
};

const VENUE_CHALLENGE_HINTS: Record<string, { title: string; body: string }> = {
  "blink-theater": {
    title: "Blink pulse",
    body: "Ative Browser Cam ou ESP32, fixe no cartaz e use piscadas para trocar a cena sem tocar em nada.",
  },
  "arcade-bay": {
    title: "Arcade focus",
    body: "Use o olhar para selecionar rapidamente a lane do jogo e confirme com blink ou Enter.",
  },
  "signal-observatory": {
    title: "Readability test",
    body: "Compare como o sistema reage em idle, face detectada e gaze realmente ativo.",
  },
  "vision-dock": {
    title: "Preview check",
    body: "Veja se a camera, o overlay e o gaze cru estao coerentes antes de ir para uma experiencia mais sensivel.",
  },
  "command-cafe": {
    title: "Command stream",
    body: "Observe os eventos entrando em tempo real e valide se a fonte do input esta clara para o usuario.",
  },
  "latency-lab": {
    title: "Feel test",
    body: "Compare Browser Cam e ESP32 para entender quando a latencia ainda parece natural e quando ela pesa.",
  },
};

const SkyportWorldScene = dynamic(
  () => import("@/components/world/skyport-world-scene").then((module) => module.SkyportWorldScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[780px] items-center justify-center rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(10,12,32,0.93))] text-sm uppercase tracking-[0.22em] text-white/55">
        loading skyport world
      </div>
    ),
  },
);

export default function WorldPage() {
  const [device, setDevice] = useState<Device | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [neutralPose, setNeutralPose] = useState<{ yaw: number; pitch: number } | null>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("off");
  const [openVenueId, setOpenVenueId] = useState<string | null>(null);
  const [venueCursorIndex, setVenueCursorIndex] = useState(1);
  const [venueActiveIndex, setVenueActiveIndex] = useState(1);
  const [worldCommands, setWorldCommands] = useState<CommandEvent[]>([]);

  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const remoteData = useDashboardData(session?.id ?? null, trackingMode === "remote");
  const localData = useLocalEyeTracking(trackingMode === "local");
  const lastVenueBlinkRef = useRef(0);

  useEffect(() => {
    const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);

    if (storedDevice) {
      try {
        setDevice(JSON.parse(storedDevice) as Device);
      } catch {
        localStorage.removeItem(DEVICE_STORAGE_KEY);
      }
    }

    if (storedSession) {
      try {
        setSession(JSON.parse(storedSession) as Session);
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
        // Browser Cam mode still works without a remote session.
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
        // Surfaced elsewhere in the HUD.
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [device, trackingMode]);

  const activeFaceMetrics =
    trackingMode === "local" ? localData.faceMetrics : trackingMode === "remote" ? remoteData.faceMetrics : null;
  const activeGazePoint =
    trackingMode === "local" ? localData.gazePoint : trackingMode === "remote" ? remoteData.gazePoint : null;
  const activeLastFrame =
    trackingMode === "local" ? localData.lastFrame : trackingMode === "remote" ? remoteData.lastFrame : null;
  const activePose = trackingMode === "local" ? localData.pose : trackingMode === "remote" ? remoteData.pose : IDLE_POSE;
  const blinkCount = trackingMode === "local" ? localData.blinkCount : trackingMode === "remote" ? remoteData.blinkCount : 0;
  const lastBlinkAt =
    trackingMode === "local" ? localData.lastBlinkAt : trackingMode === "remote" ? remoteData.lastBlinkAt : null;
  const framesProcessed =
    trackingMode === "local" ? localData.framesProcessed : trackingMode === "remote" ? remoteData.framesProcessed : 0;
  const wsStatus = trackingMode === "local" ? localData.wsStatus : trackingMode === "remote" ? remoteData.wsStatus : "manual";
  const lastError = trackingMode === "local" ? localData.lastError : trackingMode === "remote" ? remoteData.lastError : null;
  const motionLatencyMs =
    trackingMode === "local"
      ? localData.processingLatencyMs ?? activeLastFrame?.age_ms ?? null
      : trackingMode === "remote"
        ? activeLastFrame?.age_ms ?? null
        : null;
  const processingLatencyMs =
    trackingMode === "local"
      ? localData.processingLatencyMs ?? activeLastFrame?.latency_ms ?? null
      : trackingMode === "remote"
        ? activeLastFrame?.latency_ms ?? null
        : null;

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
  const attentionState = useMemo(() => {
    if (trackingMode === "off") {
      return IDLE_ATTENTION_STATE;
    }

    return deriveAttentionState({
      faceMetrics: activeFaceMetrics,
      centeredYaw,
      centeredPitch,
    });
  }, [activeFaceMetrics, centeredPitch, centeredYaw, trackingMode]);

  const nearbyVenue = useMemo(() => getDistrictById(nearDistrictId), [nearDistrictId]);
  const openVenue = useMemo(() => getDistrictById(openVenueId), [openVenueId]);
  const venueCursorAction = useMemo(
    () => getDistrictActionByIndex(openVenueId, venueCursorIndex),
    [openVenueId, venueCursorIndex],
  );
  const venueActiveAction = useMemo(
    () => getDistrictActionByIndex(openVenueId, venueActiveIndex),
    [openVenueId, venueActiveIndex],
  );

  useEffect(() => {
    if (!openVenueId) {
      return;
    }

    setVenueCursorIndex(1);
    setVenueActiveIndex(1);
  }, [openVenueId]);

  useEffect(() => {
    if (!openVenueId) {
      return;
    }

    const sourceActive =
      attentionState.eyeTrackingActive || (trackingMode !== "off" && attentionState.source !== "idle" && attentionState.intensity > 0.16);
    if (!sourceActive) {
      return;
    }

    const nextIndex = attentionState.rawX < 0.38 ? 0 : attentionState.rawX > 0.62 ? 2 : 1;
    setVenueCursorIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [attentionState.eyeTrackingActive, attentionState.intensity, attentionState.rawX, attentionState.source, openVenueId, trackingMode]);

  const confirmVenueAction = useCallback(
    (source: "blink" | "keyboard" | "click") => {
      if (!openVenueId) {
        return;
      }

      const action = getDistrictActionByIndex(openVenueId, venueCursorIndex);
      const district = getDistrictById(openVenueId);
      if (!action || !district) {
        return;
      }

      setVenueActiveIndex(venueCursorIndex);
      setStatusMessage(`${district.title}: ${action.label.toLowerCase()} ativado via ${source}.`);

      pushLocalCommand(setWorldCommands, {
        command: action.id === "story" ? "VENUE_STORY" : action.id === "challenge" ? "VENUE_CHALLENGE" : "VENUE_EXPERIENCE",
        confidence: 0.98,
        trigger: source,
        source: trackingMode === "local" ? "browser_cam" : trackingMode === "remote" ? "esp32_backend" : "keyboard_only",
        meta_json: {
          district_id: district.id,
          action_id: action.id,
          action_label: action.label,
          tracking_mode: trackingMode,
        },
      });
    },
    [openVenueId, trackingMode, venueCursorIndex],
  );

  useEffect(() => {
    if (!openVenueId) {
      lastVenueBlinkRef.current = blinkCount;
      return;
    }

    if (blinkCount <= lastVenueBlinkRef.current) {
      return;
    }

    lastVenueBlinkRef.current = blinkCount;
    confirmVenueAction("blink");
  }, [blinkCount, confirmVenueAction, openVenueId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!openVenueId) {
        if (event.key === "Escape") {
          setOpenVenueId(null);
        }
        return;
      }

      if (event.key === "Escape") {
        setOpenVenueId(null);
        setStatusMessage("Experiencia fechada.");
        return;
      }

      if (event.key === "1") {
        setVenueCursorIndex(0);
      } else if (event.key === "2") {
        setVenueCursorIndex(1);
      } else if (event.key === "3") {
        setVenueCursorIndex(2);
      } else if (event.key === "Enter" || event.key === " ") {
        confirmVenueAction("keyboard");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmVenueAction, openVenueId]);

  const handleTrackingModeChange = useCallback(
    (mode: TrackingMode) => {
      setTrackingMode(mode);
      setStatusMessage(
        mode === "off"
          ? "Exploracao manual ativa. Ligue tracking so dentro do lugar que voce for usar."
          : mode === "local"
            ? "Browser Cam ativada."
            : "ESP32 / Backend ativado.",
      );
    },
    [],
  );

  const handleEnterDistrict = useCallback(
    (payload: { districtId: string; source: "blink" | "keyboard" | "click" }) => {
      const district = getDistrictById(payload.districtId);
      if (!district) {
        return;
      }

      setOpenVenueId(payload.districtId);
      setVenueCursorIndex(1);
      setVenueActiveIndex(1);
      setStatusMessage(`${district.title} aberto via ${payload.source}.`);

      pushLocalCommand(setWorldCommands, {
        command: "VENUE_ENTER",
        confidence: 0.99,
        trigger: payload.source,
        source: trackingMode === "local" ? "browser_cam" : trackingMode === "remote" ? "esp32_backend" : "keyboard_only",
        meta_json: {
          district_id: payload.districtId,
          tracking_mode: trackingMode,
        },
      });
    },
    [trackingMode],
  );

  const commands = useMemo(() => {
    if (trackingMode !== "remote") {
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
    <div className="space-y-4">
      <section>
        <SkyportWorldScene
          trackingMode={trackingMode}
          blinkPulse={blinkCount}
          motionLatencyMs={motionLatencyMs}
          openDistrictId={openVenueId}
          onEnterDistrict={handleEnterDistrict}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <aside className="glass-panel rounded-[32px] p-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <TopPill label={trackingMode === "off" ? "keyboard only" : wsStatus} icon={trackingMode === "off" ? EyeOff : Activity} />
              <TopPill
                label={
                  trackingMode === "off"
                    ? "tracking opcional"
                    : attentionState.eyeTrackingActive
                      ? "gaze ativo"
                      : attentionState.source === "idle"
                        ? "aguardando face"
                        : "fallback pose"
                }
                icon={trackingMode === "off" ? Gamepad2 : Sparkles}
              />
              <TopPill label={activePose.faceDetected ? "face on" : "face off"} icon={Camera} />
              <TopPill label={nearbyVenue?.title ?? "exploring"} icon={MapPinned} />
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.28em] text-white/45">World dock</p>
            <p className="mt-2 text-3xl font-semibold text-white">Ande, entre e so depois ligue tracking</p>
            <p className="mt-3 text-sm leading-6 text-white/62">
              `WASD/setas` movem o personagem. `Enter` abre o lugar mais proximo. Browser Cam e ESP32 ficam como
              camada opcional so dentro da experiencia.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <QuickIntentCard title="Walk" value="WASD / setas" body="Locomocao principal no teclado." />
            <QuickIntentCard title="Enter" value={nearbyVenue?.title ?? "lugar proximo"} body="Chegue perto e pressione Enter." />
            <QuickIntentCard
              title="Track"
              value={trackingMode === "off" ? "desligado" : trackingMode === "local" ? "browser cam" : "esp32 relay"}
              body="Ative tracking apenas quando entrar."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/live"
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/12 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-300/20"
            >
              Abrir Control Room
            </Link>
            <button
              type="button"
              onClick={() => {
                if (nearbyVenue) {
                  handleEnterDistrict({ districtId: nearbyVenue.id, source: "keyboard" });
                }
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
            >
              Entrar no lugar proximo
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenVenueId(null);
                setStatusMessage("Modo de exploracao ativo.");
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
            >
              Fechar experiencia
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

          <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Tracking source</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {trackingMode === "off" ? "Sem camera" : trackingMode === "local" ? "Browser Cam" : "ESP32 / Backend"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Browser Cam e o modo mais natural para experimentar o gaze. ESP32 continua disponivel para validar o
                  pipeline real do hardware.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/68">
                global
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ModeButton active={trackingMode === "off"} label="Sem Camera" onClick={() => handleTrackingModeChange("off")} />
              <ModeButton active={trackingMode === "local"} label="Browser Cam" onClick={() => handleTrackingModeChange("local")} />
              <ModeButton active={trackingMode === "remote"} label="ESP32 / Backend" onClick={() => handleTrackingModeChange("remote")} />
              {trackingMode === "local" ? (
                <ModeButton
                  active={false}
                  label="Recenter"
                  onClick={() => {
                    localData.recenter();
                    setStatusMessage("Centro local atualizado.");
                  }}
                />
              ) : null}
              {trackingMode === "local" && (localData.localStatus === "blocked" || localData.localStatus === "error") ? (
                <ModeButton
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

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Places</p>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/62">
                clique ou entre andando
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {SKYPORT_DISTRICTS.map((district) => (
                <VenueCard
                  key={district.id}
                  district={district}
                  nearby={nearbyVenue?.id === district.id}
                  active={openVenue?.id === district.id}
                  onOpen={() => {
                    setOpenVenueId(district.id);
                    setVenueCursorIndex(1);
                    setVenueActiveIndex(1);
                    setStatusMessage(`${district.title} aberto pelo painel.`);
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        <section className="glass-panel rounded-[32px] p-5">
          {openVenue ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Inside venue</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{openVenue.title}</p>
                  <p className="mt-2 text-sm text-white/60">{openVenue.subtitle}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/72">
                  {trackingMode === "off" ? "manual" : trackingMode === "local" ? "browser cam" : "esp32 / backend"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {openVenue.actions.map((action, index) => (
                  <VenueActionCard
                    key={action.id}
                    label={action.label}
                    description={action.description}
                    slot={index + 1}
                    selected={venueCursorAction?.id === action.id}
                    active={venueActiveAction?.id === action.id}
                    onClick={() => {
                      setVenueCursorIndex(index);
                      setVenueActiveIndex(index);
                      setStatusMessage(`${openVenue.title}: ${action.label.toLowerCase()} aberto pelo painel.`);
                    }}
                  />
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/52">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">1-2-3 select</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Enter or blink confirm</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Esc close</span>
              </div>

              <div className="mt-5 min-h-[540px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.72))] p-4">
                {renderVenueContent({
                  district: openVenue,
                  activeActionId: venueActiveAction?.id ?? "enter",
                  trackingMode,
                  onSelectTrackingMode: handleTrackingModeChange,
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
            </>
          ) : (
            <EmptyVenueState nearbyVenue={nearbyVenue} />
          )}
        </section>
      </section>
    </div>
  );
}

function renderVenueContent(input: {
  district: WorldDistrict;
  activeActionId: "story" | "enter" | "challenge";
  trackingMode: TrackingMode;
  onSelectTrackingMode: (mode: TrackingMode) => void;
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
  if (input.activeActionId === "story") {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Sobre o lugar</p>
          <p className="mt-3 text-3xl font-semibold text-white">{input.district.title}</p>
          <p className="mt-4 text-sm leading-7 text-white/65">{input.district.lore}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard title="Ambiencia" body={input.district.ambientLabel} />
          <InfoCard
            title="Uso do eye tracking"
            body="Dentro do lugar, o olhar serve para selecionar ou mirar a experiencia. A locomocao continua no teclado."
          />
        </div>
      </div>
    );
  }

  if (input.trackingMode === "off") {
    return <TrackingModePrompt district={input.district} onSelectTrackingMode={input.onSelectTrackingMode} />;
  }

  if (input.activeActionId === "challenge") {
    const hint = VENUE_CHALLENGE_HINTS[input.district.id];
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Challenge</p>
          <p className="mt-3 text-3xl font-semibold text-white">{hint?.title ?? "Quick test"}</p>
          <p className="mt-3 text-sm leading-7 text-white/65">{hint?.body ?? "Use esse lugar para validar o tracking com uma tarefa curta."}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <StatCard label="Tracking" value={input.trackingMode === "local" ? "Browser Cam" : "ESP32"} />
          <StatCard label="Motion" value={input.lastFrameAgeMs === null ? "--" : `${Math.round(input.lastFrameAgeMs)} ms`} />
          <StatCard label="Proc" value={input.lastFrameLatencyMs === null ? "--" : `${Math.round(input.lastFrameLatencyMs)} ms`} />
          <StatCard label="Blinks" value={String(input.blinkCount)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard
            title="O que observar"
            body="Veja se a selecao responde sem parecer gimmick. O ideal e o usuario entender o feedback em poucos segundos."
          />
          <InfoCard
            title="Quando usar"
            body={
              input.trackingMode === "local"
                ? "Use Browser Cam quando quiser fluidez real e feedback imediato no notebook."
                : "Use ESP32 para demonstrar o hardware e o pipeline remoto end-to-end."
            }
          />
        </div>
      </div>
    );
  }

  switch (input.district.boothId) {
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
              width={900}
              height={440}
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
              width={900}
              height={440}
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

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Raw gaze map</p>
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
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Last cues</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <StatCard label="Tracking" value={input.attentionState.source === "eye_gaze" ? "IRIS" : "POSE"} />
              <StatCard label="Direction" value={input.attentionState.direction.toUpperCase()} />
            </div>
          </div>
          <div className="h-[420px] rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <CommandLog commands={input.commands} />
          </div>
        </div>
      );
    case "latency-lab":
      return (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Latency Lab</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {input.lastFrameAgeMs === null ? "--" : `${Math.round(input.lastFrameAgeMs)} ms`}
            </p>
            <p className="mt-2 text-white/65">tempo entre frame util e resposta percebida no mundo</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard title="Para navegar" body="Browser Cam local ainda e o modo mais natural para exploracao e interacoes rapidas." />
            <InfoCard title="Para demo de hardware" body="ESP32 continua util para provar o pipeline embarcado e o backend em tempo real." />
            <InfoCard title="Quando insistir no ESP32" body="Use backend local na LAN se quiser reduzir o salto de rede e testar algo mais responsivo." />
            <InfoCard title="Proxima otimizacao" body="Mover mais trabalho para tracking local e reduzir o custo na thread principal da UI." />
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
    </div>
  );
}

function QuickIntentCard({
  title,
  value,
  body,
}: {
  title: string;
  value: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{title}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
    </div>
  );
}

function ModeButton({
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

function VenueCard({
  district,
  nearby,
  active,
  onOpen,
}: {
  district: WorldDistrict;
  nearby: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        active
          ? "rounded-[24px] border border-cyan-300/28 bg-cyan-300/12 p-4 text-left shadow-[0_0_28px_rgba(34,211,238,0.14)]"
          : nearby
            ? "rounded-[24px] border border-white/15 bg-white/[0.08] p-4 text-left"
            : "rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">{district.signLabel}</p>
          <p className="mt-2 text-lg font-semibold text-white">{district.title}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{district.subtitle}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/68">
          {active ? "aberto" : nearby ? "perto" : "abrir"}
        </div>
      </div>
    </button>
  );
}

function VenueActionCard({
  label,
  description,
  slot,
  selected,
  active,
  onClick,
}: {
  label: string;
  description: string;
  slot: number;
  selected: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[22px] border border-cyan-300/35 bg-cyan-300/12 px-4 py-4 text-left text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
          : selected
            ? "rounded-[22px] border border-amber-300/28 bg-amber-300/10 px-4 py-4 text-left text-white"
            : "rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-white/72 transition hover:bg-white/[0.08]"
      }
    >
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">slot 0{slot}</p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-2 text-xs leading-5 text-white/56">{description}</p>
    </button>
  );
}

function EmptyVenueState({ nearbyVenue }: { nearbyVenue: WorldDistrict | null }) {
  return (
    <div className="flex h-full min-h-[540px] flex-col justify-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.7),rgba(2,6,23,0.6))] p-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-white/42">No place open</p>
      <p className="mt-4 text-3xl font-semibold text-white">
        {nearbyVenue ? `Voce esta perto de ${nearbyVenue.title}` : "Ande pelo mundo e entre em um lugar"}
      </p>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/62">
        {nearbyVenue
          ? "Pressione Enter no mundo ou clique no card desse lugar para abrir a experiencia."
          : "O painel da direita so abre quando um lugar e selecionado. Assim o mundo fica limpo e a camera nao vira obrigatoria antes da hora."}
      </p>
    </div>
  );
}

function TrackingModePrompt({
  district,
  onSelectTrackingMode,
}: {
  district: WorldDistrict;
  onSelectTrackingMode: (mode: TrackingMode) => void;
}) {
  return (
    <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Tracking opcional</p>
          <p className="mt-2 text-2xl font-semibold text-white">{district.title}</p>
          <p className="mt-3 text-sm leading-6 text-white/62">
            Escolha uma fonte so para este lugar. O mundo continua 100% navegavel no teclado sem nenhuma camera ligada.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/68">
          walk first
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectTrackingMode("local")}
          className="rounded-[24px] border border-cyan-300/22 bg-cyan-300/12 p-4 text-left text-cyan-50 transition hover:bg-cyan-300/18"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/72">Browser Cam</p>
          <p className="mt-2 text-lg font-semibold">Mais fluido para testar gaze no notebook.</p>
          <p className="mt-2 text-sm leading-6 text-cyan-50/72">Sem salto de rede. Melhor para menu, preview e minigames.</p>
        </button>

        <button
          type="button"
          onClick={() => onSelectTrackingMode("remote")}
          className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left text-white transition hover:bg-white/[0.08]"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">ESP32 / Backend</p>
          <p className="mt-2 text-lg font-semibold">Melhor para demonstrar o pipeline real do hardware.</p>
          <p className="mt-2 text-sm leading-6 text-white/62">Use quando quiser provar a integracao embarcada end-to-end.</p>
        </button>
      </div>
    </div>
  );
}

function pushLocalCommand(
  setter: Dispatch<SetStateAction<CommandEvent[]>>,
  command: Omit<CommandEvent, "cooldown_ms" | "ts">,
) {
  setter((current) =>
    [
      {
        ...command,
        cooldown_ms: 0,
        ts: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 40),
  );
}
