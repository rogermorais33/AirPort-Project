"use client";

import { useEffect, useMemo, useState } from "react";

import {
  endSession,
  getActiveSession,
  heartbeatDevice,
  openPage,
  registerDevice,
  startSession,
} from "@/lib/api";
import type { Device, Session } from "@/lib/types";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { CommandLog } from "@/components/gazepilot/command-log";
import { GazeOverlay } from "@/components/gazepilot/gaze-overlay";
import { PoseMeter } from "@/components/gazepilot/pose-meter";

const DEVICE_STORAGE_KEY = "gazepilot-device-v1";
const SESSION_STORAGE_KEY = "gazepilot-session-v1";

export default function LivePage() {
  const [deviceName, setDeviceName] = useState("ESP32-CAM Desk");
  const [device, setDevice] = useState<Device | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [pageUrl, setPageUrl] = useState("https://example.com");

  const { health, pose, gazePoint, commands, framesProcessed, wsStatus, refreshHealth } = useDashboardData(
    session?.id ?? null,
  );

  useEffect(() => {
    const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);

    if (storedDevice) {
      setDevice(JSON.parse(storedDevice) as Device);
    }
    if (storedSession) {
      setSession(JSON.parse(storedSession) as Session);
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
  const overlayHeight = 500;

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

  async function handleRegisterDevice() {
    try {
      const created = await registerDevice({
        name: deviceName,
        fw_version: "0.1.0",
      });
      setDevice(created);
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(created));
      setStatusMessage("Dispositivo registrado com sucesso.");
      await refreshHealth();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao registrar dispositivo");
    }
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
        setDevice(currentDevice);
        localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(currentDevice));
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
      const active = await getActiveSession(device.id);
      setSession(active);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(active));
      setStatusMessage("Sessão ativa vinculada ao dashboard.");
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
      <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Device</p>
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Nome do dispositivo"
          />
          <button
            type="button"
            onClick={handleRegisterDevice}
            className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500"
          >
            Registrar Device
          </button>
          <button
            type="button"
            onClick={() => void handleQuickStart()}
            className="ml-2 mt-3 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-cyan-50 hover:bg-cyan-500"
          >
            Quick Start
          </button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Sessão</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleStartSession("mvp")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-400 hover:text-emerald-200"
            >
              Start MVP
            </button>
            <button
              type="button"
              onClick={() => void handleStartSession("calibration")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-amber-400 hover:text-amber-200"
            >
              Start Calibration
            </button>
            <button
              type="button"
              onClick={() => void handleEndSession()}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-rose-400 hover:text-rose-200"
            >
              End Session
            </button>
            <button
              type="button"
              onClick={() => void handleAttachActiveSession()}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-cyan-400 hover:text-cyan-200"
            >
              Attach Active
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Página ativa</p>
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="https://..."
          />
          <button
            type="button"
            onClick={() => void handleOpenPage()}
            className="mt-3 rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
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
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Realtime</p>
          <p className="mt-2 text-sm text-zinc-300">WS: {wsStatus}</p>
          <p className="text-sm text-zinc-300">Frames: {framesProcessed}</p>
          <p className="text-sm text-zinc-300">Pose backend: {pose.backend}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Contexto atual</p>
          <p className="mt-2 text-sm text-zinc-300">Device ID: {device?.id ?? "-"}</p>
          <p className="text-sm text-zinc-300">Session ID: {session?.id ?? "-"}</p>
          {statusMessage ? <p className="mt-2 text-sm text-emerald-300">{statusMessage}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <PoseMeter label="Yaw" value={pose.yaw} threshold={20} />
        <PoseMeter label="Pitch" value={pose.pitch} threshold={15} />
        <PoseMeter label="Roll" value={pose.roll} threshold={15} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Gaze Overlay</p>
          <GazeOverlay
            width={overlayWidth}
            height={overlayHeight}
            x={gazeCanvasPoint.x}
            y={gazeCanvasPoint.y}
            confidence={gazePoint?.confidence ?? 0}
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Command Log</p>
          <CommandLog commands={commands} />
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
            Se frames = 0 por mais de 20s, clique em <code>Attach Active</code> para sincronizar sessão.
          </li>
          <li>Se persistir, revise rede/firewall/porta serial e reinicie sessão.</li>
        </ul>
      </section>
    </div>
  );
}
