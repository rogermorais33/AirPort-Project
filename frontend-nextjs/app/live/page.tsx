"use client";

import { useEffect, useMemo, useState } from "react";

import {
  endSession,
  getActiveSession,
  getDeviceByKey,
  heartbeatDevice,
  openPage,
  registerDevice,
  startSession,
} from "@/lib/api";
import type { Device, Session } from "@/lib/types";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { CommandLog } from "@/components/gazepilot/command-log";
import { GazeOverlay } from "@/components/gazepilot/gaze-overlay";
import { LivePreview } from "@/components/gazepilot/live-preview";
import { PoseMeter } from "@/components/gazepilot/pose-meter";

const DEVICE_STORAGE_KEY = "gazepilot-device-v1";
const SESSION_STORAGE_KEY = "gazepilot-session-v1";
const YAW_THRESHOLD = 20;
const PITCH_THRESHOLD = 15;

const SUPPORTED_ACTIONS = [
  { command: "NEXT", movement: "Girar cabeça para direita", trigger: "yaw > +20° por ~400ms" },
  { command: "PREV", movement: "Girar cabeça para esquerda", trigger: "yaw < -20° por ~400ms" },
  { command: "SCROLL_DOWN", movement: "Inclinar cabeça para baixo", trigger: "pitch < -15° por ~400ms" },
  { command: "SCROLL_UP", movement: "Inclinar cabeça para cima", trigger: "pitch > +15° por ~400ms" },
];
const RECOGNIZED_SIGNALS = [
  { name: "Yaw", meaning: "giro horizontal da cabeça" },
  { name: "Pitch", meaning: "inclinação vertical da cabeça" },
  { name: "Roll", meaning: "inclinação lateral da cabeça" },
  { name: "Blink", meaning: "piscar detectado (informativo)" },
  { name: "Face X/Y", meaning: "posição normalizada do rosto no frame" },
];

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

export default function LivePage() {
  const [deviceName, setDeviceName] = useState("ESP32-CAM Desk");
  const [device, setDevice] = useState<Device | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [manualDeviceId, setManualDeviceId] = useState("");
  const [manualDeviceKey, setManualDeviceKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pageUrl, setPageUrl] = useState("https://example.com");
  const [neutralPose, setNeutralPose] = useState<{ yaw: number; pitch: number } | null>(null);

  const { health, pose, gazePoint, commands, framesProcessed, wsStatus, refreshHealth, faceMetrics } = useDashboardData(
    session?.id ?? null,
  );

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
        setStatusMessage("Contexto local carregado do navegador.");
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
        // Heartbeat failures are reflected in backend health/WS status.
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [device]);

  const overlayWidth = 900;
  const overlayHeight = 360;

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
  const candidateAction = useMemo(() => inferCandidateAction(centeredYaw, centeredPitch), [centeredPitch, centeredYaw]);
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
      setStatusMessage("Pose neutra limpa. Aguarde o rosto ser detectado para recalibrar automaticamente.");
      return;
    }

    setNeutralPose({ yaw: pose.yaw, pitch: pose.pitch });
    setStatusMessage("Pose neutra reajustada com base no frame atual.");
  }

  async function handleRegisterDevice() {
    try {
      const created = await registerDevice({
        name: deviceName,
        fw_version: "0.1.0",
      });
      setDeviceContext(created);
      const active = await attachActiveSessionForDevice(created.id);
      if (active) {
        setStatusMessage("Novo device registrado e sessão ativa vinculada.");
      } else {
        setStatusMessage(
          "Novo device registrado. Atenção: isto cria outro DEVICE_ID/KEY; atualize o firmware se quiser usar este.",
        );
      }
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
      if (active) {
        setStatusMessage("Device existente vinculado e sessão ativa anexada.");
      } else {
        setStatusMessage("Device existente vinculado. Nenhuma sessão ativa encontrada para ele.");
      }
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
    setStatusMessage("Contexto local removido (device/sessão).");
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
      setStatusMessage("Quick start concluído: device registrado e sessão MVP iniciada.");
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
      if (active) {
        setStatusMessage("Sessão ativa vinculada ao dashboard.");
        return;
      }
      setStatusMessage("Nenhuma sessão ativa encontrada.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nenhuma sessão ativa encontrada");
    }
  }

  async function handleOpenPage() {
    if (!session) {
      setStatusMessage("Inicie uma sessão antes de abrir uma página.");
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
      <section className="rounded-3xl border border-cyan-900/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_50%),linear-gradient(180deg,rgba(9,9,11,0.95),rgba(3,7,18,0.96))] p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">GazePilot Live Control</p>
        <p className="mt-2 text-sm text-zinc-300">
          Fluxo recomendado: <strong>Vincular Existente</strong> → <strong>Sincronizar Sessão Ativa</strong> →
          monitorar preview e comandos.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">WebSocket</p>
            <p className="mt-1 text-sm text-zinc-200">{wsStatus}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Sessão Atual</p>
            <p className="mt-1 truncate text-sm text-zinc-200">{session?.id ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Backend CV</p>
            <p className="mt-1 text-sm text-zinc-200">{health?.cv_backend_active ?? "-"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Device</p>
          <p className="mt-1 text-xs text-zinc-500">
            Se o firmware já possui <code>DEVICE_ID/KEY</code>, use <code>Vincular Existente</code>.
          </p>
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Nome do dispositivo"
          />
          <input
            value={manualDeviceId}
            onChange={(event) => setManualDeviceId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="device_id (opcional)"
          />
          <input
            value={manualDeviceKey}
            onChange={(event) => setManualDeviceKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="device_key"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleLinkExistingDevice()}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-cyan-50 hover:bg-cyan-500"
            >
              Vincular Existente
            </button>
            <button
              type="button"
              onClick={handleRegisterDevice}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-400 hover:text-emerald-200"
            >
              Registrar Novo
            </button>
          </div>
          <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
            <summary className="cursor-pointer text-xs text-zinc-400">Ações avançadas</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleQuickStart()}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-cyan-400 hover:text-cyan-200"
              >
                Quick Start
              </button>
              <button
                type="button"
                onClick={handleClearLocalContext}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-rose-400 hover:text-rose-200"
              >
                Limpar Contexto
              </button>
            </div>
          </details>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Sessão</p>
          <p className="mt-1 text-xs text-zinc-500">
            <code>Start Calibration</code> é opcional para refinar gaze; para comandos básicos não é obrigatório.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Ao iniciar nova sessão, o preview pode pausar por ~5s até a ESP32 reanexar automaticamente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleAttachActiveSession()}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500"
            >
              Sincronizar Sessão Ativa
            </button>
            <button
              type="button"
              onClick={() => void handleStartSession("mvp")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-cyan-400 hover:text-cyan-200"
            >
              Iniciar Sessão MVP
            </button>
          </div>
          <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
            <summary className="cursor-pointer text-xs text-zinc-400">Controles avançados de sessão</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleStartSession("calibration")}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-amber-400 hover:text-amber-200"
              >
                Start Calibration
              </button>
              <button
                type="button"
                onClick={() => void handleEndSession()}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-rose-400 hover:text-rose-200"
              >
                End Session
              </button>
            </div>
          </details>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Página ativa (opcional)</p>
          <p className="mt-1 text-xs text-zinc-500">
            Use isso apenas para analytics/heatmap de página. Não é necessário para comandos.
          </p>
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="https://..."
          />
          <button
            type="button"
            onClick={() => void handleOpenPage()}
            className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-cyan-400 hover:text-cyan-200"
          >
            Registrar Página
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Backend</p>
          <p className="mt-2 text-sm text-zinc-300">API: {health?.api ?? "-"}</p>
          <p className="text-sm text-zinc-300">DB: {health?.database ?? "-"}</p>
          <p className="text-sm text-zinc-300">Queue: {health?.queue_mode ?? "-"}</p>
          <p className="text-sm text-zinc-300">CV ativo: {health?.cv_backend_active ?? "-"}</p>
          <p className="text-sm text-zinc-300">
            MediaPipe: {health?.mediapipe_available ? "loaded" : "fallback"}
          </p>
          {health?.mediapipe_error ? (
            <p className="mt-1 text-xs text-amber-300">MediaPipe error: {health.mediapipe_error}</p>
          ) : null}
          {health?.cv_backend_active === "none" ? (
            <p className="mt-2 text-xs text-rose-300">
              CV inativo: sem detecção real. Confira container/backend e dependências do MediaPipe.
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Realtime</p>
          <p className="mt-2 text-sm text-zinc-300">WS: {wsStatus}</p>
          <p className="text-sm text-zinc-300">Frames: {framesProcessed}</p>
          <p className="text-sm text-zinc-300">Pose backend: {pose.backend}</p>
          <p className="text-sm text-zinc-300">Face detectada: {pose.faceDetected ? "sim" : "não"}</p>
          <p className="text-sm text-zinc-300">Ação candidata: {candidateAction ?? "-"}</p>
          <p className="text-sm text-zinc-300">Última ação: {commands[0]?.command ?? "-"}</p>
          <p className="text-xs text-zinc-500">
            yaw/pitch corrigidos: {centeredYaw.toFixed(1)} / {centeredPitch.toFixed(1)}
          </p>
          <button
            type="button"
            onClick={resetNeutralPose}
            className="mt-2 rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:border-cyan-400 hover:text-cyan-200"
          >
            Recalibrar Pose Neutra
          </button>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Contexto atual</p>
          <p className="mt-2 text-sm text-zinc-300">Device ID: {device?.id ?? "-"}</p>
          <p className="text-sm text-zinc-300">Device Key: {device?.device_key ?? "-"}</p>
          <p className="text-sm text-zinc-300">Session ID: {session?.id ?? "-"}</p>
          {statusMessage ? <p className="mt-2 text-sm text-emerald-300">{statusMessage}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-sm font-semibold text-zinc-200">Guia rápido (2 minutos)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-400">
          <li>Em Device, use Vincular Existente com o device_key do ESP32.</li>
          <li>Na seção Sessão, clique em Sincronizar Sessão Ativa.</li>
          <li>Confirme WS conectado e Frames aumentando no painel Realtime.</li>
          <li>No Preview, centralize o rosto e clique Recalibrar Pose Neutra se o pitch estiver enviesado.</li>
          <li>Mova a cabeça por ~0.4s para direita/esquerda/cima/baixo e verifique o Command Log.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-sm font-semibold text-zinc-200">Como o reconhecimento funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>
            A ESP32-CAM <strong>não</strong> classifica ações localmente; ela só envia frames JPEG.
          </li>
          <li>
            Comandos são inferidos por <strong>movimento da cabeça</strong> (yaw/pitch), não por olhar isolado.
          </li>
          <li>
            <code>Yaw</code>: rotação horizontal da cabeça (direita positivo, esquerda negativo).
          </li>
          <li>
            <code>Pitch</code>: rotação vertical (cima positivo, baixo negativo).
          </li>
          <li>
            <code>Roll</code>: inclinação lateral da cabeça (apoio visual, não dispara comandos).
          </li>
          <li>
            <code>Gaze Overlay</code>: projeção estimada do ponto de atenção na tela.
          </li>
          <li>
            Olhos/íris contribuem para o ponto de gaze, mas a ação (<code>NEXT/PREV/SCROLL</code>) vem da pose da cabeça.
          </li>
        </ul>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {RECOGNIZED_SIGNALS.map((signal) => (
            <div key={signal.name} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <p className="text-xs font-semibold text-zinc-300">{signal.name}</p>
              <p className="text-xs text-zinc-500">{signal.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-sm font-semibold text-zinc-200">Ações detectáveis</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SUPPORTED_ACTIONS.map((item) => (
            <div key={item.command} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-sm font-semibold text-emerald-300">{item.command}</p>
              <p className="mt-1 text-xs text-zinc-400">{item.movement}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.trigger}</p>
            </div>
          ))}
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>Teste rápido: mantenha cada movimento por ~0.4s.</li>
          <li>Evite movimentos muito curtos; existe suavização e cooldown.</li>
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:grid-rows-[auto_auto]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:row-start-1">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Preview da ESP32-CAM</p>
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <PoseMeter label="Yaw" value={centeredYaw} threshold={YAW_THRESHOLD} />
            <PoseMeter label="Pitch" value={centeredPitch} threshold={PITCH_THRESHOLD} />
            <PoseMeter label="Roll" value={pose.roll} threshold={15} />
          </div>
          <LivePreview
            sessionId={session?.id ?? null}
            width={960}
            height={540}
            yaw={centeredYaw}
            pitch={centeredPitch}
            roll={pose.roll}
            faceDetected={pose.faceDetected}
            suggestedAction={candidateAction}
            faceXNorm={faceXNorm}
            faceYNorm={faceYNorm}
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:row-start-2">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Gaze Overlay</p>
          <GazeOverlay
            width={overlayWidth}
            height={overlayHeight}
            x={gazeCanvasPoint.x}
            y={gazeCanvasPoint.y}
            confidence={gazePoint?.confidence ?? 0}
          />
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 lg:row-span-2">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Command Log</p>
          <p className="mb-3 text-xs text-zinc-500">Histórico de comandos disparados durante a sessão ativa.</p>
          <div className="min-h-0 flex-1">
            <CommandLog commands={commands} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="mb-2 text-sm font-semibold text-zinc-200">Checklist ESP32-CAM (físico)</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>Use rede Wi-Fi 2.4GHz (ESP32-CAM não conecta em 5GHz).</li>
          <li>
            <code>API_BASE_URL</code> deve apontar para IP local da máquina backend (ex.:{" "}
            <code>192.168.x.x:8000</code>).
          </li>
          <li>
            Após upload, remova jumper <code>IO0 -&gt; GND</code> e aperte <code>RST</code> para
            boot normal.
          </li>
          <li>
            No serial, confirme <code>[wifi] connected</code>, <code>[session] id=...</code>,{" "}
            <code>[frame] status=202</code>.
          </li>
          <li>
            Se clicar em <code>Registrar Novo Device</code>, o backend gera um novo <code>device_id/device_key</code>.
          </li>
          <li>
            Se frames = 0 por mais de 20s, clique em <code>Attach Active</code> para sincronizar sessão.
          </li>
          <li>Se persistir, revise rede/firewall/porta serial e reinicie sessão.</li>
        </ul>
      </section>
    </div>
  );
}
