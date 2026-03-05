export interface HealthStatus {
  api: string;
  influxdb: string;
  timestamp: string;
}

export interface SensorReading {
  timestamp: string;
  device_id: string;
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number | null;
  gas_resistance_ohm: number;
  voc_index: number | null;
  air_quality_score: number | null;
  is_urgent: boolean;
  is_heartbeat: boolean;
  metadata?: Record<string, unknown>;
}

export interface DashboardFilters {
  deviceId: string;
  minutes: number;
  limit: number;
  autoRefresh: boolean;
  refreshMs: number;
}
