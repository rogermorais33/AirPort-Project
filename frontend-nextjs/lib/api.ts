import type { HealthStatus, SensorReading } from "@/lib/types";

const API_ROOT = (process.env.NEXT_PUBLIC_DASHBOARD_API_ROOT ?? "/api/proxy/v1").replace(/\/$/, "");

interface RequestOptions {
  allow404?: boolean;
  signal?: AbortSignal;
}

async function requestApi<T>(
  path: string,
  query: Record<string, string | number> = {},
  options: RequestOptions = {},
): Promise<T | null> {
  const url = new URL(`${API_ROOT}${path}`, window.location.origin);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: options.signal,
  });

  if (options.allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let detail = `Erro ${response.status}`;

    try {
      const json = await response.json();
      if (json?.detail) {
        detail = String(json.detail);
      }
    } catch {
      // Mantém detalhe padrão.
    }

    throw new Error(`${path}: ${detail}`);
  }

  return (await response.json()) as T;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const data = await requestApi<HealthStatus>("/health", {}, { signal });
  if (!data) {
    throw new Error("Health indisponível");
  }
  return data;
}

export async function getLatestReading(
  deviceId: string,
  signal?: AbortSignal,
): Promise<SensorReading | null> {
  const data = await requestApi<SensorReading>(
    "/readings/latest",
    { device_id: deviceId },
    { signal, allow404: true },
  );
  return data;
}

export async function getReadings(
  deviceId: string,
  minutes: number,
  limit: number,
  signal?: AbortSignal,
): Promise<SensorReading[]> {
  const data = await requestApi<SensorReading[]>(
    "/readings",
    {
      device_id: deviceId,
      minutes,
      limit,
    },
    { signal },
  );

  return data ?? [];
}
