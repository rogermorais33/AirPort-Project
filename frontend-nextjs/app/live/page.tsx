"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  Globe,
  Play,
  RefreshCcw,
  Sparkles,
  Wifi,
} from "lucide-react";

import {
  endSession,
  getActiveSession,
  getDeviceByKey,
  heartbeatDevice,
  openPage,
  registerDevice,
  startSession,
} from "@/lib/api";
import { AttentionCompass } from "@/components/gazepilot/attention-compass";
import { BlinkMemory } from "@/components/gazepilot/blink-memory";
import { CommandLog } from "@/components/gazepilot/command-log";
import { GazeArcade } from "@/components/gazepilot/gaze-arcade";
import { GazeOverlay } from "@/components/gazepilot/gaze-overlay";
import { GazeWorld } from "@/components/gazepilot/gaze-world";
import { LivePreview } from "@/components/gazepilot/live-preview";
import { PoseMeter } from "@/components/gazepilot/pose-meter";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { deriveAttentionState } from "@/lib/gaze";
import type { Device, Session } from "@/lib/types";

const DEVICE_STORAGE_KEY = "gazepilot-device-v1";
const SESSION_STORAGE_KEY = "gazepilot-session-v1";
const YAW_THRESHOLD = 20;
const PITCH_THRESHOLD = 15;

function inferCandidateAction(yaw: number, pitch: number): string | null {
  if (yaw > YAW_THRESHOLD) {
    return "NEXT";
  }
  if (yaw < -YAW_THRESHOLD) {
    return "PREV";
  }
  if (pitch < -PITCH_THRESHOLD) {
    return "SCROLL_DOWN";
  }
  if (pitch > PITCH_THRESHOLD) {
    return "SCROLL_UP";
  }
  return null;
}

function mapDirectionToCommand(direction: "left" | "right" | "up" | "down" | "center"): string | null {
  switch (direction) {
    case "right":
      return "NEXT";
    case "left":
      return "PREV";
    case "up":
      return "SCROLL_UP";
    case "down":
      return "SCROLL_DOWN";
    default:
      return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function LivePage() {
  const [deviceName, setDeviceName] = useState("ESP32-CAM Desk");
  const [device, setDevice] = useState<Device | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [manualDeviceId, setManualDeviceId] = useState("");
  const [manualDeviceKey, setManualDeviceKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pageUrl, setPageUrl] = useState("https://example.com");
  const [neutralPose, setNeutralPose] = useState<{ yaw: number; pitch: number } | null>(null);

  const {
    health,
    pose,
    gazePoint,
    commands,
    framesProcessed,
    wsStatus,
    refreshHealth,
    faceMetrics,
    lastFrame,
    blinkCount,
    lastBlinkAt,
  } = useDashboardData(session?.id ?? null);

  useEffect(() => {
    const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    let parsedDevice: Device | null = null;

    if (storedDevice) {
      try {
        parsedDevice = JSON.parse(storedDevice) as Device;
        setDevice(parsedDevice);
        setManualDeviceId(parsedDevice.id);
        setManualDeviceKey(parsedDevice.device_key);
        setStatusMessage("Contexto local restaurado.");
      } catch {
        localStorage.removeItem(DEVICE_STORAGE_KEY);
      }
    }

    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession) as Session;
        if (!parsedDevice || parsedSession.device_id === parsedDevice.id) {
          setSession(parsedSession);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!device) {
      return;
    }

    const interval = window.setInterval(() => {
      void heartbeatDevice({
        device_id: device.id,
        device_key: device.device_key,
        fw_version: device.fw_version,
      }).catch(() => {
        // Heartbeat failures surface via ws/health.
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [device]);

  useEffect(() => {
    if (!session?.id) {
      setNeutralPose(null);
    }
  }, [session?.id]);

  useEffect(() => {
    if (!pose.faceDetected) {
      return;
    }

    setNeutralPose((current) => {
      if (!current) {
        return { yaw: pose.yaw, pitch: pose.pitch };
      }

      const nearNeutral =
        Math.abs(pose.yaw - current.yaw) < YAW_THRESHOLD * 0.7 &&
        Math.abs(pose.pitch - current.pitch) < PITCH_THRESHOLD * 0.7;
      if (!nearNeutral) {
        return current;
      }

      return {
        yaw: current.yaw * 0.98 + pose.yaw * 0.02,
        pitch: current.pitch * 0.98 + pose.pitch * 0.02,
      };
    });
  }, [pose.faceDetected, pose.pitch, pose.yaw]);

  const centeredYaw = pose.yaw - (neutralPose?.yaw ?? 0);
  const centeredPitch = pose.pitch - (neutralPose?.pitch ?? 0);
  const attentionState = useMemo(
    () =>
      deriveAttentionState({
        faceMetrics,
        centeredYaw,
        centeredPitch,
      }),
    [centeredPitch, centeredYaw, faceMetrics],
  );
  const poseCandidateAction = useMemo(() => inferCandidateAction(centeredYaw, centeredPitch), [centeredPitch, centeredYaw]);
  const liveIntent = useMemo(() => mapDirectionToCommand(attentionState.direction), [attentionState.direction]);
  const suggestedAction = attentionState.direction === "center" ? poseCandidateAction : liveIntent;

  const overlayWidth = 900;
  const overlayHeight = 320;

  const gazeCanvasPoint = useMemo(() => {
    if (!gazePoint) {
      return { x: null, y: null };
    }

    if (session?.screen_w && session.screen_h) {
      return {
        x: (gazePoint.x / session.screen_w) * overlayWidth,
        y: (gazePoint.y / session.screen_h) * overlayHeight,
      };
    }

    const isNormalized = gazePoint.x >= 0 && gazePoint.x <= 1 && gazePoint.y >= 0 && gazePoint.y <= 1;
    if (isNormalized) {
      return {
        x: gazePoint.x * overlayWidth,
        y: gazePoint.y * overlayHeight,
      };
    }

    return {
      x: gazePoint.x,
      y: gazePoint.y,
    };
  }, [gazePoint, session]);

  const worldPointer = useMemo(() => {
    if (gazePoint) {
      if (session?.screen_w && session.screen_h) {
        return {
          x: clamp(gazePoint.x / session.screen_w, 0, 1),
          y: clamp(gazePoint.y / session.screen_h, 0, 1),
        };
      }

      if (gazePoint.x >= 0 && gazePoint.x <= 1 && gazePoint.y >= 0 && gazePoint.y <= 1) {
        return {
          x: clamp(gazePoint.x, 0, 1),
          y: clamp(gazePoint.y, 0, 1),
        };
      }
    }

    return {
      x: attentionState.rawX,
      y: attentionState.rawY,
    };
  }, [attentionState.rawX, attentionState.rawY, gazePoint, session]);

  const faceXNorm = useMemo(() => {
    const value = faceMetrics?.features?.face_x_norm;
    return typeof value === "number" ? value : null;
  }, [faceMetrics?.features]);

  const faceYNorm = useMemo(() => {
    const value = faceMetrics?.features?.face_y_norm;
    return typeof value === "number" ? value : null;
  }, [faceMetrics?.features]);

  async function attachActiveSessionForDevice(targetDeviceId: string): Promise<Session | null> {
    try {
      const active = await getActiveSession(targetDeviceId);
      setSession(active);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(active));
      return active;
    } catch {
      setSession(null);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  function setDeviceContext(nextDevice: Device) {
    setDevice(nextDevice);
    setManualDeviceId(nextDevice.id);
    setManualDeviceKey(nextDevice.device_key);
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(nextDevice));
  }

  function resetNeutralPose() {
    if (!pose.faceDetected) {
      setNeutralPose(null);
      setStatusMessage("Pose neutra limpa. Aguarde a face reaparecer para recalibrar.");
      return;
    }

    setNeutralPose({ yaw: pose.yaw, pitch: pose.pitch });
    setStatusMessage("Pose neutra alinhada com o frame atual.");
  }

  async function handleRegisterDevice() {
    try {
      const created = await registerDevice({
        name: deviceName,
        fw_version: "0.1.0",
      });
      setDeviceContext(created);
      const active = await attachActiveSessionForDevice(created.id);
      setStatusMessage(active ? "Novo device criado e sessão ativa anexada." : "Novo device criado. Atualize o firmware se quiser usar esta chave.");
      await refreshHealth();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao registrar dispositivo");
    }
  }

  async function handleLinkExistingDevice() {
    const key = manualDeviceKey.trim();
    if (!key) {
      setStatusMessage("Informe o device_key para vincular um device existente.");
      return;
    }

    try {
      const existing = await getDeviceByKey(key);
      const typedId = manualDeviceId.trim();
      if (typedId && typedId !== existing.id) {
        setStatusMessage("O device_id informado não corresponde ao device_key.");
        return;
      }

      setDeviceContext(existing);
      const active = await attachActiveSessionForDevice(existing.id);
      setStatusMessage(active ? "Device conectado e sessão ativa anexada." : "Device conectado. Nenhuma sessão ativa encontrada.");
      await refreshHealth();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao vincular device existente");
    }
  }

  function handleClearLocalContext() {
    setDevice(null);
    setSession(null);
    setManualDeviceId("");
    setManualDeviceKey("");
    localStorage.removeItem(DEVICE_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setStatusMessage("Contexto local removido.");
  }

  async function handleStartSession(mode: "mvp" | "calibration") {
    if (!device) {
      setStatusMessage("Registre um dispositivo antes de iniciar sessão.");
      return;
    }

    try {
      const response = await startSession({
        device_id: device.id,
        screen_w: 1366,
        screen_h: 768,
        mode,
      });

      setSession(response.session);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response.session));
      setStatusMessage(`Sessão ${mode.toUpperCase()} iniciada.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao iniciar sessão");
    }
  }

  async function handleQuickStart() {
    try {
      let currentDevice = device;
      if (!currentDevice) {
        currentDevice = await registerDevice({
          name: deviceName,
          fw_version: "0.1.0",
        });
        setDeviceContext(currentDevice);
      }

      const response = await startSession({
        device_id: currentDevice.id,
        screen_w: 1366,
        screen_h: 768,
        mode: "mvp",
      });

      setSession(response.session);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(response.session));
      setStatusMessage("Quick start concluído.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha no quick start");
    }
  }

  async function handleEndSession() {
    if (!session) {
      return;
    }

    try {
      await endSession(session.id);
      setStatusMessage("Sessão encerrada.");
      setSession(null);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao encerrar sessão");
    }
  }

  async function handleAttachActiveSession() {
    if (!device) {
      setStatusMessage("Registre um dispositivo antes de anexar sessão.");
      return;
    }

    try {
      const active = await attachActiveSessionForDevice(device.id);
      setStatusMessage(active ? "Sessão ativa sincronizada com o dashboard." : "Nenhuma sessão ativa encontrada.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nenhuma sessão ativa encontrada");
    }
  }

  async function handleOpenPage() {
    if (!session) {
      setStatusMessage("Inicie uma sessão antes de registrar uma página.");
      return;
    }

    try {
      await openPage(session.id, {
        url: pageUrl,
        title: "Navegação ativa",
      });
      setStatusMessage("Página registrada para heatmap.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao registrar página");
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,32,0.96),rgba(11,13,29,0.94)_48%,rgba(23,10,27,0.92))] px-5 py-6 shadow-[0_30px_90px_rgba(2,6,23,0.42)] md:px-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.14),transparent_26%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill icon={Wifi} label={`ws ${wsStatus}`} tone="cyan" />
              <Pill icon={Camera} label={pose.faceDetected ? "face on" : "face off"} tone={pose.faceDetected ? "emerald" : "slate"} />
              <Pill icon={Activity} label={`${health?.cv_backend_active ?? "cv"} mode`} tone="amber" />
              <Pill icon={Sparkles} label={attentionState.eyeTrackingActive ? "iris live" : "fallback pose"} tone="pink" />
            </div>

            <h1 className="mt-5 max-w-3xl font-heading text-4xl leading-tight text-white md:text-5xl">
              Um cockpit mais divertido para pilotar a navegação com o olhar.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              O pipeline agora usa sinais reais de íris quando disponíveis, transforma isso em direção viva e já liga
              esse input a um mundo interativo e a um mini game estilo arcade.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <ActionButton icon={Play} onClick={() => void handleQuickStart()} tone="cyan">
                Quick Start
              </ActionButton>
              <ActionButton icon={RefreshCcw} onClick={() => void handleAttachActiveSession()} tone="emerald">
                Sincronizar Sessão
              </ActionButton>
              <ActionButton icon={Sparkles} onClick={resetNeutralPose} tone="slate">
                Recalibrar Pose
              </ActionButton>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <HeroStat
                label="Intento ao vivo"
                value={suggestedAction ?? "IDLE"}
                hint={attentionState.source === "eye_gaze" ? "guiado pela íris" : "guiado pela pose"}
              />
              <HeroStat label="Frames" value={String(framesProcessed)} hint={session?.id ? "stream ativo" : "sem sessão"} />
              <HeroStat
                label="Tracking"
                value={attentionState.direction === "center" ? "CENTRO" : attentionState.direction.toUpperCase()}
                hint={attentionState.eyeTrackingActive ? "eye tracking real" : "fallback ativo"}
              />
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/45">Pulse dock</p>
                <p className="mt-2 text-2xl font-semibold text-white">Status instantâneo</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60">
                {session ? "live session" : "awaiting session"}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <DockRow label="Device" value={device?.name ?? "não vinculado"} />
              <DockRow label="Session" value={session?.id?.slice(0, 10) ?? "-"} />
              <DockRow label="Backend" value={health?.cv_backend_active ?? "-"} />
              <DockRow label="Último comando" value={commands[0]?.command ?? "nenhum"} />
            </div>

            {statusMessage ? (
              <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {statusMessage}
              </div>
            ) : null}

            {health?.mediapipe_error ? (
              <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {health.mediapipe_error}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.28fr_0.88fr]">
        <div className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Vision Deck</p>
              <p className="mt-2 text-2xl font-semibold text-white">Preview + feedback em tempo real</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/60">
              yaw {centeredYaw.toFixed(1)} / pitch {centeredPitch.toFixed(1)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <PoseMeter label="Yaw" value={centeredYaw} threshold={YAW_THRESHOLD} />
            <PoseMeter label="Pitch" value={centeredPitch} threshold={PITCH_THRESHOLD} />
            <PoseMeter label="Roll" value={pose.roll} threshold={15} />
          </div>

          <div className="mt-5">
            <LivePreview
              sessionId={session?.id ?? null}
              width={960}
              height={540}
              yaw={centeredYaw}
              pitch={centeredPitch}
              roll={pose.roll}
              faceDetected={pose.faceDetected}
              suggestedAction={suggestedAction}
              attentionDirection={attentionState.direction}
              attentionSource={attentionState.source}
              gazeRawX={attentionState.rawX}
              gazeRawY={attentionState.rawY}
              faceXNorm={faceXNorm}
              faceYNorm={faceYNorm}
            />
          </div>
        </div>

        <AttentionCompass
          direction={attentionState.direction}
          source={attentionState.source}
          intensity={attentionState.intensity}
          eyeTrackingActive={attentionState.eyeTrackingActive}
          confidence={gazePoint?.confidence ?? pose.confidence ?? 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GazeWorld
          direction={attentionState.direction}
          source={attentionState.source}
          pointerX={worldPointer.x}
          pointerY={worldPointer.y}
          latestCommand={commands[0]?.command ?? null}
          wsStatus={wsStatus}
        />

        <GazeArcade
          direction={attentionState.direction}
          source={attentionState.source}
          signalStrength={attentionState.intensity}
          active={pose.faceDetected}
        />
      </section>

      <BlinkMemory
        blinkCount={blinkCount}
        lastBlinkAt={lastBlinkAt}
        blinkActive={Boolean(faceMetrics?.blink)}
        motionLatencyMs={lastFrame?.age_ms ?? null}
        processingLatencyMs={lastFrame?.latency_ms ?? null}
        framesProcessed={framesProcessed}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <ControlPanel
          icon={Camera}
          eyebrow="Device Dock"
          title="Pareamento"
          body="Cole o device_key do hardware ou crie um novo registro."
        >
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
            placeholder="Nome do dispositivo"
          />
          <input
            value={manualDeviceId}
            onChange={(event) => setManualDeviceId(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
            placeholder="device_id (opcional)"
          />
          <input
            value={manualDeviceKey}
            onChange={(event) => setManualDeviceKey(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
            placeholder="device_key"
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Wifi} onClick={() => void handleLinkExistingDevice()} tone="cyan">
              Vincular
            </ActionButton>
            <ActionButton icon={Sparkles} onClick={handleRegisterDevice} tone="slate">
              Registrar
            </ActionButton>
            <ActionButton icon={RefreshCcw} onClick={handleClearLocalContext} tone="slate">
              Limpar
            </ActionButton>
          </div>
        </ControlPanel>

        <ControlPanel
          icon={Activity}
          eyebrow="Session Engine"
          title="Comandos e calibração"
          body="Suba uma sessão live ou entre no modo de calibração quando quiser refinar o gaze."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton icon={Play} onClick={() => void handleStartSession("mvp")} tone="emerald">
              Sessão MVP
            </ActionButton>
            <ActionButton icon={Sparkles} onClick={() => void handleStartSession("calibration")} tone="amber">
              Calibration
            </ActionButton>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton icon={RefreshCcw} onClick={() => void handleAttachActiveSession()} tone="cyan">
              Attach Active
            </ActionButton>
            <ActionButton icon={Activity} onClick={() => void handleEndSession()} tone="slate">
              Encerrar
            </ActionButton>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70">
            movimentos: direita/esquerda/cima/baixo. Quando a íris estiver disponível, o backend prioriza eye tracking
            real; sem isso, cai para pose.
          </div>
        </ControlPanel>

        <ControlPanel
          icon={Globe}
          eyebrow="Page Pulse"
          title="Heatmap ativo"
          body="Associe uma página para gravar o mapa de atenção da sessão."
        >
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
            placeholder="https://..."
          />
          <ActionButton icon={Globe} onClick={() => void handleOpenPage()} tone="cyan">
            Registrar Página
          </ActionButton>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70">
            session {session?.id?.slice(0, 10) ?? "--"} • source {gazePoint?.source ?? attentionState.source}
          </div>
        </ControlPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="glass-panel rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Signal Trail</p>
              <p className="mt-2 text-2xl font-semibold text-white">Mapa vivo do gaze</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/60">
              {gazePoint?.source ?? "raw"}
            </div>
          </div>
          <div className="mt-5">
            <GazeOverlay
              width={overlayWidth}
              height={overlayHeight}
              x={gazeCanvasPoint.x}
              y={gazeCanvasPoint.y}
              confidence={gazePoint?.confidence ?? 0}
            />
          </div>
        </div>

        <div className="glass-panel flex min-h-[420px] flex-col rounded-[32px] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Command Stream</p>
              <p className="mt-2 text-2xl font-semibold text-white">Histórico de ações</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/60">
              {commands.length} eventos
            </div>
          </div>
          <div className="mt-5 min-h-0 flex-1">
            <CommandLog commands={commands} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
  tone,
}: {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  tone: "cyan" | "emerald" | "amber" | "slate";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-300/12 text-cyan-50 hover:bg-cyan-300/18"
      : tone === "emerald"
        ? "border-emerald-300/20 bg-emerald-300/12 text-emerald-50 hover:bg-emerald-300/18"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-300/12 text-amber-50 hover:bg-amber-300/18"
          : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </button>
  );
}

function Pill({
  icon: Icon,
  label,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: "cyan" | "emerald" | "amber" | "pink" | "slate";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
      : tone === "emerald"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
          : tone === "pink"
            ? "border-pink-300/20 bg-pink-300/10 text-pink-100"
            : "border-white/10 bg-white/[0.05] text-white/70";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.2em] ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.05] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/55">{hint}</p>
    </div>
  );
}

function DockRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.24em] text-white/45">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm text-white">{value}</span>
    </div>
  );
}

function ControlPanel({
  icon: Icon,
  eyebrow,
  title,
  body,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-[30px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">{eyebrow}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white/75">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}
