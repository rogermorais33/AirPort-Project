"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getHealth, getLatestReading, getReadings } from "@/lib/api";
import type { DashboardFilters, HealthStatus, SensorReading } from "@/lib/types";

const FILTER_STORAGE_KEY = "airport-dashboard-filters-v1";

const DEFAULT_DEVICE_ID = process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID ?? "esp32-wokwi-001";

const DEFAULT_FILTERS: DashboardFilters = {
  deviceId: DEFAULT_DEVICE_ID,
  minutes: 60,
  limit: 240,
  autoRefresh: true,
  refreshMs: 15000,
};

const WS_PING_INTERVAL_MS = 25000;
const WS_PONG_TIMEOUT_MS = 10000;
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_CAP_MS = 30000;
const REST_SYNC_WHEN_WS_CONNECTED_MS = 300000;

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

interface DashboardDataState {
  health: HealthStatus | null;
  latest: SensorReading | null;
  readingsDesc: SensorReading[];
  syncedAt: Date | null;
}

interface DashboardHookState {
  data: DashboardDataState;
  filters: DashboardFilters;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  realtimeStatus: RealtimeStatus;
  setFilters: (next: DashboardFilters) => void;
  refreshNow: () => Promise<void>;
  readingsAsc: SensorReading[];
}

interface WsMessageEnvelope {
  type: string;
  message?: string;
  data?: SensorReading;
}

function clamp(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function readInitialFilters(): DashboardFilters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }

  let parsed: Partial<DashboardFilters> = {};

  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      parsed = JSON.parse(raw) as Partial<DashboardFilters>;
    }
  } catch {
    parsed = {};
  }

  const params = new URLSearchParams(window.location.search);
  const queryDeviceId = params.get("device_id")?.trim();

  return {
    deviceId: queryDeviceId || parsed.deviceId?.trim() || DEFAULT_FILTERS.deviceId,
    minutes: clamp(Number(parsed.minutes), DEFAULT_FILTERS.minutes, 1, 43200),
    limit: clamp(Number(parsed.limit), DEFAULT_FILTERS.limit, 1, 2000),
    autoRefresh:
      typeof parsed.autoRefresh === "boolean"
        ? parsed.autoRefresh
        : DEFAULT_FILTERS.autoRefresh,
    refreshMs: clamp(Number(parsed.refreshMs), DEFAULT_FILTERS.refreshMs, 5000, 300000),
  };
}

function normalizeReading(reading: SensorReading | null): SensorReading | null {
  if (!reading?.timestamp) {
    return null;
  }

  const parsedDate = new Date(reading.timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    ...reading,
    timestamp: parsedDate.toISOString(),
    device_id: String(reading.device_id ?? ""),
    temperature_c: Number(reading.temperature_c),
    humidity_pct: Number(reading.humidity_pct),
    pressure_hpa: reading.pressure_hpa === null ? null : Number(reading.pressure_hpa),
    gas_resistance_ohm: Number(reading.gas_resistance_ohm),
    voc_index: reading.voc_index === null ? null : Number(reading.voc_index),
    air_quality_score:
      reading.air_quality_score === null ? null : Number(reading.air_quality_score),
    is_urgent: Boolean(reading.is_urgent),
    is_heartbeat: Boolean(reading.is_heartbeat),
  };
}

function normalizeList(list: SensorReading[]): SensorReading[] {
  return list
    .map(normalizeReading)
    .filter((item): item is SensorReading => Boolean(item))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

function mergeLatest(latest: SensorReading | null, list: SensorReading[]): SensorReading[] {
  if (!latest) {
    return list;
  }

  if (list.length === 0) {
    return [latest];
  }

  if (list[0]?.timestamp === latest.timestamp) {
    return list;
  }

  return [latest, ...list].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

function upsertReading(
  reading: SensorReading,
  current: SensorReading[],
  limit: number,
): SensorReading[] {
  const deduped = current.filter(
    (item) => !(item.timestamp === reading.timestamp && item.device_id === reading.device_id),
  );

  const merged = [reading, ...deduped].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return merged.slice(0, limit);
}

function getWsBaseUrl(): string {
  const explicitWs = process.env.NEXT_PUBLIC_BACKEND_WS_BASE_URL?.trim();
  if (explicitWs) {
    return explicitWs.replace(/\/$/, "");
  }

  const httpBase = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL?.trim();
  if (httpBase) {
    if (httpBase.startsWith("https://")) {
      return httpBase.replace("https://", "wss://").replace(/\/$/, "");
    }

    if (httpBase.startsWith("http://")) {
      return httpBase.replace("http://", "ws://").replace(/\/$/, "");
    }
  }

  if (typeof window === "undefined") {
    return "ws://localhost:8000";
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function buildWebSocketUrl(deviceId: string): string {
  const url = new URL(`${getWsBaseUrl()}/api/v1/ws/readings`);
  url.searchParams.set("device_id", deviceId);
  return url.toString();
}

function getReconnectDelayMs(attempt: number): number {
  const exponential = Math.min(WS_RECONNECT_CAP_MS, WS_RECONNECT_BASE_MS * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 1000);
  return exponential + jitter;
}

export function useDashboardData(): DashboardHookState {
  const [filters, setFilters] = useState<DashboardFilters>(() => readInitialFilters());
  const [data, setData] = useState<DashboardDataState>({
    health: null,
    latest: null,
    readingsDesc: [],
    syncedAt: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("disconnected");

  const requestControllerRef = useRef<AbortController | null>(null);

  const persistFilters = useCallback((nextFilters: DashboardFilters) => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(nextFilters));

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("device_id", nextFilters.deviceId);
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const loadData = useCallback(
    async (isForeground: boolean) => {
      requestControllerRef.current?.abort();

      const controller = new AbortController();
      requestControllerRef.current = controller;

      if (isForeground) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const [health, latestRaw, listRaw] = await Promise.all([
          getHealth(controller.signal),
          getLatestReading(filters.deviceId, controller.signal),
          getReadings(filters.deviceId, filters.minutes, filters.limit, controller.signal),
        ]);

        const latest = normalizeReading(latestRaw);
        const list = normalizeList(listRaw);
        const merged = mergeLatest(latest, list);

        setData({
          health,
          latest: merged[0] ?? null,
          readingsDesc: merged,
          syncedAt: new Date(),
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : "Falha ao carregar dados do dashboard";
        setError(message);
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }

        if (isForeground) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [filters.deviceId, filters.minutes, filters.limit],
  );

  useEffect(() => {
    void loadData(true);

    return () => {
      requestControllerRef.current?.abort();
    };
  }, [loadData]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: number | null = null;
    let pingIntervalId: number | null = null;
    let pongTimeoutId: number | null = null;
    let closedManually = false;
    let reconnectAttempts = 0;

    const clearPing = () => {
      if (pingIntervalId !== null) {
        window.clearInterval(pingIntervalId);
        pingIntervalId = null;
      }
    };

    const clearPongTimeout = () => {
      if (pongTimeoutId !== null) {
        window.clearTimeout(pongTimeoutId);
        pongTimeoutId = null;
      }
    };

    const clearReconnect = () => {
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnect();
      if (closedManually || (typeof navigator !== "undefined" && !navigator.onLine)) {
        return;
      }

      const backoffMs = getReconnectDelayMs(reconnectAttempts);
      reconnectAttempts += 1;
      reconnectTimeoutId = window.setTimeout(connect, backoffMs);
    };

    const connect = () => {
      clearReconnect();
      if (closedManually) {
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setRealtimeStatus("disconnected");
        return;
      }

      if (socket && socket.readyState <= WebSocket.OPEN) {
        return;
      }

      setRealtimeStatus("connecting");

      try {
        socket = new WebSocket(buildWebSocketUrl(filters.deviceId));
      } catch {
        setRealtimeStatus("error");
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        setRealtimeStatus("connected");
        reconnectAttempts = 0;
        clearPing();
        clearPongTimeout();

        pingIntervalId = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            try {
              socket.send("ping");
              clearPongTimeout();
              pongTimeoutId = window.setTimeout(() => {
                if (socket?.readyState === WebSocket.OPEN) {
                  socket.close(4000, "Pong timeout");
                }
              }, WS_PONG_TIMEOUT_MS);
            } catch {
              socket.close(1011, "Heartbeat failed");
            }
          }
        }, WS_PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsMessageEnvelope;
          if (payload.type === "pong") {
            clearPongTimeout();
            return;
          }

          if (payload.type === "overloaded") {
            setError(payload.message ?? "Canal em tempo real indisponível. Tentando reconectar...");
            return;
          }

          if (payload.type !== "reading_ingested" && payload.type !== "latest_snapshot") {
            return;
          }

          const incomingReading = normalizeReading(payload.data ?? null);
          if (!incomingReading) {
            return;
          }

          setData((current) => {
            const updatedReadings = upsertReading(
              incomingReading,
              current.readingsDesc,
              filters.limit,
            );

            return {
              ...current,
              latest: updatedReadings[0] ?? null,
              readingsDesc: updatedReadings,
              syncedAt: new Date(),
            };
          });
          setError(null);
        } catch {
          // Ignora mensagem inválida.
        }
      };

      socket.onerror = () => {
        setRealtimeStatus("error");
      };

      socket.onclose = () => {
        clearPing();
        clearPongTimeout();
        if (closedManually) {
          setRealtimeStatus("disconnected");
          return;
        }

        setRealtimeStatus("disconnected");
        scheduleReconnect();
      };
    };

    const handleOnline = () => {
      reconnectAttempts = 0;
      connect();
    };

    const handleOffline = () => {
      setRealtimeStatus("disconnected");
      clearReconnect();
      clearPing();
      clearPongTimeout();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close(1000, "Client offline");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    connect();

    return () => {
      closedManually = true;
      clearPing();
      clearPongTimeout();
      clearReconnect();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [filters.deviceId, filters.limit]);

  useEffect(() => {
    if (!filters.autoRefresh) {
      return;
    }

    const intervalMs =
      realtimeStatus === "connected"
        ? Math.max(filters.refreshMs, REST_SYNC_WHEN_WS_CONNECTED_MS)
        : filters.refreshMs;

    const intervalId = window.setInterval(() => {
      void loadData(false);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filters.autoRefresh, filters.refreshMs, loadData, realtimeStatus]);

  const applyFilters = useCallback(
    (next: DashboardFilters) => {
      setFilters(next);
      persistFilters(next);
    },
    [persistFilters],
  );

  const refreshNow = useCallback(async () => {
    await loadData(false);
  }, [loadData]);

  const readingsAsc = useMemo(
    () => [...data.readingsDesc].reverse(),
    [data.readingsDesc],
  );

  return {
    data,
    filters,
    loading,
    refreshing,
    error,
    realtimeStatus,
    setFilters: applyFilters,
    refreshNow,
    readingsAsc,
  };
}
