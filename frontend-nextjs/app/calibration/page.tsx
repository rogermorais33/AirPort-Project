"use client";

import { useCallback, useMemo, useState } from "react";

import { addCalibrationPoint, createCalibrationProfile, trainCalibrationProfile } from "@/lib/api";
import type { CalibrationProfile, CalibrationTrainResult, WsEnvelope } from "@/lib/types";
import { useWebSocket } from "@/hooks/use-websocket";

function buildTargets(mode: "5" | "9") {
  if (mode === "5") {
    return [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.1, y: 0.9 },
      { x: 0.9, y: 0.9 },
    ];
  }

  return [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.1, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: 0.1, y: 0.9 },
    { x: 0.5, y: 0.9 },
    { x: 0.9, y: 0.9 },
  ];
}

export default function CalibrationPage() {
  const [deviceId, setDeviceId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [profileName, setProfileName] = useState("Default Calibration");
  const [pointsMode, setPointsMode] = useState<"5" | "9">("5");
  const [profile, setProfile] = useState<CalibrationProfile | null>(null);
  const [latestFeatures, setLatestFeatures] = useState<Record<string, number> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [trainResult, setTrainResult] = useState<CalibrationTrainResult | null>(null);

  const targets = useMemo(() => buildTargets(pointsMode), [pointsMode]);

  const onWsEvent = useCallback((event: WsEnvelope) => {
    if (event.type === "face_metrics" && event.data) {
      const data = event.data as { features?: Record<string, number> };
      if (data.features) {
        setLatestFeatures(data.features);
      }
    }
  }, []);

  useWebSocket({
    sessionId: sessionId || null,
    onEvent: onWsEvent,
  });

  async function handleCreateProfile() {
    if (!deviceId) {
      setMessage("Informe um device_id.");
      return;
    }

    try {
      const created = await createCalibrationProfile({
        device_id: deviceId,
        name: profileName,
      });
      setProfile(created);
      setActiveIndex(0);
      setTrainResult(null);
      setMessage(`Perfil criado: ${created.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar perfil");
    }
  }

  async function handleCapturePoint() {
    if (!profile) {
      setMessage("Crie um perfil antes de capturar pontos.");
      return;
    }

    const target = targets[activeIndex];
    if (!target) {
      return;
    }

    try {
      await addCalibrationPoint({
        profile_id: profile.id,
        target_x: target.x,
        target_y: target.y,
        features_json: latestFeatures ?? undefined,
        session_id: sessionId || undefined,
      });

      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      setMessage(`Ponto ${nextIndex}/${targets.length} capturado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao capturar ponto");
    }
  }

  async function handleTrain() {
    if (!profile) {
      setMessage("Crie um perfil antes de treinar.");
      return;
    }

    try {
      const result = await trainCalibrationProfile(profile.id);
      setTrainResult(result);
      setMessage("Treino concluído.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no treino");
    }
  }

  const currentTarget = targets[activeIndex] ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h1 className="text-xl font-semibold text-zinc-100">Calibration Wizard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Capture 5 ou 9 pontos para treinar regressão linear de gaze.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="device_id"
          />
          <input
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="session_id (opcional mas recomendado)"
          />
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="nome do perfil"
          />
          <select
            value={pointsMode}
            onChange={(event) => setPointsMode(event.target.value as "5" | "9")}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="5">5 pontos (rápido)</option>
            <option value="9">9 pontos (mais preciso)</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCreateProfile()}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500"
          >
            Criar Perfil
          </button>
          <button
            type="button"
            onClick={() => void handleCapturePoint()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-emerald-400 hover:text-emerald-200"
          >
            Capturar Ponto Atual
          </button>
          <button
            type="button"
            onClick={() => void handleTrain()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-amber-400 hover:text-amber-200"
          >
            Treinar Perfil
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="text-sm text-zinc-300">Perfil: {profile?.id ?? "-"}</p>
        <p className="text-sm text-zinc-300">Features ao vivo: {latestFeatures ? "OK" : "aguardando"}</p>
        <p className="text-sm text-zinc-300">
          Progresso: {Math.min(activeIndex, targets.length)}/{targets.length}
        </p>

        {currentTarget ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-sm text-zinc-300">Target atual</p>
            <p className="text-lg font-semibold text-emerald-300">
              x={currentTarget.x.toFixed(2)} | y={currentTarget.y.toFixed(2)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-emerald-300">Todos os pontos capturados. Pode treinar.</p>
        )}

        {trainResult ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-sm text-zinc-300">Treino finalizado</p>
            <p className="text-sm text-zinc-200">Pontos: {trainResult.points_count}</p>
            <p className="text-sm text-zinc-200">Erro médio: {trainResult.training_error.toFixed(4)}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
