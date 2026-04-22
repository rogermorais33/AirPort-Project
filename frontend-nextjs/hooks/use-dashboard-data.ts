"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getHealth } from "@/lib/api";
import type {
  CommandEvent,
  FaceMetricsEvent,
  FrameProcessedEvent,
  GazePointEvent,
  HealthStatus,
  WsEnvelope,
} from "@/lib/types";
import { useWebSocket } from "@/hooks/use-websocket";

interface DashboardDataState {
  health: HealthStatus | null;
  faceMetrics: FaceMetricsEvent | null;
  gazePoint: GazePointEvent | null;
  lastFrame: FrameProcessedEvent | null;
  commands: CommandEvent[];
  framesProcessed: number;
  blinkCount: number;
  lastBlinkAt: string | null;
  lastError: string | null;
}

export function useDashboardData(sessionId: string | null, enabled = true) {
  const [state, setState] = useState<DashboardDataState>({
    health: null,
    faceMetrics: null,
    gazePoint: null,
    lastFrame: null,
    commands: [],
    framesProcessed: 0,
    blinkCount: 0,
    lastBlinkAt: null,
    lastError: null,
  });

  const refreshHealth = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const health = await getHealth();
      setState((current) => ({ ...current, health, lastError: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        lastError: error instanceof Error ? error.message : "Falha ao carregar health",
      }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        health: null,
        lastError: null,
      }));
      return;
    }
    void refreshHealth();
    const id = window.setInterval(() => {
      void refreshHealth();
    }, 30_000);

    return () => {
      window.clearInterval(id);
    };
  }, [enabled, refreshHealth]);

  const onWsEvent = useCallback((event: WsEnvelope) => {
    if (event.type === "frame_processed") {
      const frameData = (event.data as unknown as FrameProcessedEvent) ?? null;
      setState((current) => ({
        ...current,
        lastFrame: frameData,
        framesProcessed: current.framesProcessed + 1,
      }));
      return;
    }

    if (event.type === "face_metrics" && event.data) {
      const faceMetrics = event.data as unknown as FaceMetricsEvent;
      setState((current) => ({
        ...current,
        faceMetrics,
        blinkCount:
          faceMetrics.blink && !current.faceMetrics?.blink ? current.blinkCount + 1 : current.blinkCount,
        lastBlinkAt:
          faceMetrics.blink && !current.faceMetrics?.blink ? event.timestamp ?? current.lastBlinkAt : current.lastBlinkAt,
      }));
      return;
    }

    if (event.type === "gaze_point" && event.data) {
      const gazePoint = event.data as unknown as GazePointEvent;
      setState((current) => ({
        ...current,
        gazePoint,
      }));
      return;
    }

    if (event.type === "command_triggered" && event.data) {
      const commandData = event.data as unknown as CommandEvent;
      setState((current) => ({
        ...current,
        commands: [
          {
            ...commandData,
            ts: event.timestamp,
          },
          ...current.commands,
        ].slice(0, 40),
      }));
    }
  }, []);

  const { status, sendPing } = useWebSocket({
    sessionId,
    onEvent: onWsEvent,
    enabled,
  });

  const pose = useMemo(() => {
    const metrics = state.faceMetrics;
    return {
      yaw: metrics?.yaw ?? 0,
      pitch: metrics?.pitch ?? 0,
      roll: metrics?.roll ?? 0,
      confidence: metrics?.confidence ?? 0,
      faceDetected: Boolean(metrics?.face_detected),
      backend: metrics?.backend ?? "unknown",
    };
  }, [state.faceMetrics]);

  return {
    ...state,
    pose,
    wsStatus: status,
    refreshHealth,
    sendPing,
  };
}
