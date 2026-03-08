import type {
  CalibrationProfile,
  CalibrationTrainResult,
  CommandEvent,
  Device,
  HealthStatus,
  Session,
  SessionHeatmap,
  SessionReport,
  SessionStartResponse,
  SessionTimeline,
} from "@/lib/types";

const API_ROOT = (process.env.NEXT_PUBLIC_DASHBOARD_API_ROOT ?? "/api/proxy/v1").replace(/\/$/, "");

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  signal?: AbortSignal;
}

async function requestApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    let detail = `Erro ${response.status}`;
    try {
      const json = await response.json();
      if (json?.detail) {
        detail = String(json.detail);
      }
    } catch {
      // Keep default error text.
    }

    throw new Error(`${path}: ${detail}`);
  }

  return (await response.json()) as T;
}

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return requestApi<HealthStatus>("/health", { signal });
}

export function registerDevice(input: { name: string; fw_version?: string | null }): Promise<Device> {
  return requestApi<Device>("/devices/register", {
    method: "POST",
    body: {
      name: input.name,
      fw_version: input.fw_version ?? null,
    },
  });
}

export function getDeviceByKey(deviceKey: string): Promise<Device> {
  return requestApi<Device>(`/devices/key/${encodeURIComponent(deviceKey)}`);
}

export function heartbeatDevice(input: {
  device_id: string;
  device_key: string;
  fw_version?: string | null;
}): Promise<{ status: string; device_id: string; last_seen_at: string }> {
  return requestApi("/devices/heartbeat", {
    method: "POST",
    body: {
      device_id: input.device_id,
      device_key: input.device_key,
      fw_version: input.fw_version ?? null,
    },
  });
}

export function getDeviceConfig(deviceId: string): Promise<{
  device_id: string;
  fps: number;
  quality: number;
  resolution: string;
  max_frame_bytes: number;
}> {
  return requestApi(`/device-config/${deviceId}`);
}

export function startSession(input: {
  device_id: string;
  screen_w: number;
  screen_h: number;
  mode: "mvp" | "calibration";
}): Promise<SessionStartResponse> {
  return requestApi<SessionStartResponse>("/sessions/start", {
    method: "POST",
    body: input,
  });
}

export function endSession(sessionId: string): Promise<{ session_id: string; active: boolean; ended_at: string }> {
  return requestApi(`/sessions/${sessionId}/end`, {
    method: "POST",
  });
}

export function openPage(sessionId: string, input: { url: string; title?: string | null }) {
  return requestApi(`/sessions/${sessionId}/page`, {
    method: "POST",
    body: {
      url: input.url,
      title: input.title ?? null,
    },
  });
}

export function listSessions(limit = 100): Promise<Session[]> {
  return requestApi<Session[]>(`/sessions?limit=${limit}`);
}

export function getSession(sessionId: string): Promise<Session> {
  return requestApi<Session>(`/sessions/${sessionId}`);
}

export function getActiveSession(deviceId: string): Promise<Session> {
  return requestApi<Session>(`/sessions/active?device_id=${encodeURIComponent(deviceId)}`);
}

export function getSessionReport(sessionId: string): Promise<SessionReport> {
  return requestApi<SessionReport>(`/reports/session/${sessionId}`);
}

export function getSessionHeatmap(sessionId: string): Promise<SessionHeatmap> {
  return requestApi<SessionHeatmap>(`/reports/session/${sessionId}/heatmap`);
}

export function getSessionTimeline(sessionId: string): Promise<SessionTimeline> {
  return requestApi<SessionTimeline>(`/reports/session/${sessionId}/timeline`);
}

export function getSessionCommands(sessionId: string): Promise<CommandEvent[]> {
  return requestApi<CommandEvent[]>(`/reports/session/${sessionId}/commands`);
}

export function createCalibrationProfile(input: {
  device_id: string;
  name: string;
  model_type?: string;
}): Promise<CalibrationProfile> {
  return requestApi<CalibrationProfile>("/calibration/profile", {
    method: "POST",
    body: {
      device_id: input.device_id,
      name: input.name,
      model_type: input.model_type ?? "linear_regression",
    },
  });
}

export function addCalibrationPoint(input: {
  profile_id: string;
  target_x: number;
  target_y: number;
  features_json?: Record<string, number>;
  session_id?: string;
}) {
  return requestApi(`/calibration/${input.profile_id}/point`, {
    method: "POST",
    body: {
      target_x: input.target_x,
      target_y: input.target_y,
      features_json: input.features_json ?? null,
      session_id: input.session_id ?? null,
    },
  });
}

export function trainCalibrationProfile(profileId: string): Promise<CalibrationTrainResult> {
  return requestApi<CalibrationTrainResult>(`/calibration/${profileId}/train`, {
    method: "POST",
  });
}
