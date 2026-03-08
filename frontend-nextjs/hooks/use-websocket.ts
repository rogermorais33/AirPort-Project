"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { WsEnvelope } from "@/lib/types";

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  sessionId?: string | null;
  onEvent?: (event: WsEnvelope) => void;
}

const BASE_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 10_000;

function getWsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_WS_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const httpBase = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL?.trim();
  if (httpBase?.startsWith("https://")) {
    return httpBase.replace("https://", "wss://").replace(/\/$/, "");
  }
  if (httpBase?.startsWith("http://")) {
    return httpBase.replace("http://", "ws://").replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "ws://localhost:8000";
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8000`;
}

export function useWebSocket({ sessionId, onEvent }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);

  const url = useMemo(() => {
    const wsUrl = new URL(`${getWsBaseUrl()}/api/v1/ws/live`);
    if (sessionId) {
      wsUrl.searchParams.set("session_id", sessionId);
    }
    return wsUrl.toString();
  }, [sessionId]);

  useEffect(() => {
    let mounted = true;

    function clearReconnectTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleReconnect() {
      clearReconnectTimer();
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** reconnectAttempt) + jitter;
      timerRef.current = window.setTimeout(() => {
        if (!mounted) {
          return;
        }
        setReconnectAttempt((prev) => prev + 1);
      }, delay);
    }

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mounted) {
        return;
      }
      setStatus("connected");
      setReconnectAttempt(0);
    };

    ws.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as WsEnvelope;
        onEvent?.(parsed);
      } catch {
        // Ignore malformed events.
      }
    };

    ws.onerror = () => {
      if (!mounted) {
        return;
      }
      setStatus("error");
    };

    ws.onclose = () => {
      if (!mounted) {
        return;
      }
      setStatus("disconnected");
      scheduleReconnect();
    };

    return () => {
      mounted = false;
      clearReconnectTimer();
      ws.close();
    };
  }, [url, reconnectAttempt, onEvent]);

  return {
    status,
    sendPing: () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    },
  };
}
