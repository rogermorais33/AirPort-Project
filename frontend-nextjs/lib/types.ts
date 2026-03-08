export interface HealthStatus {
  api: string;
  database: string;
  queue_mode: string;
  redis_enabled: boolean;
  cv_backend_requested?: string;
  cv_backend_active?: string;
  mediapipe_available?: boolean;
  mediapipe_model?: string | null;
  mediapipe_error?: string | null;
  timestamp: string;
}

export interface Device {
  id: string;
  device_key: string;
  name: string;
  created_at: string;
  fw_version: string | null;
}

export interface Session {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  screen_w: number | null;
  screen_h: number | null;
  mode: "mvp" | "calibration";
  active: boolean;
}

export interface SessionStartResponse {
  session: Session;
}

export interface FrameAccepted {
  status: string;
  frame_event_id: string;
  processing_status: string;
  accepted_at: string;
}

export interface CalibrationProfile {
  id: string;
  device_id: string;
  name: string;
  created_at: string;
  model_type: string;
  points_count: number;
}

export interface CalibrationTrainResult {
  profile_id: string;
  model_type: string;
  points_count: number;
  training_error: number;
}

export interface SessionReport {
  session_id: string;
  device_id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  frames_total: number;
  frames_done: number;
  frames_error: number;
  commands_total: number;
  avg_latency_ms: number | null;
  face_detection_rate: number;
}

export interface SessionHeatmap {
  session_id: string;
  bins: number[][];
  grid_w: number;
  grid_h: number;
  total_points: number;
  max_bin: number;
}

export interface TimelineBucket {
  ts: string;
  frames: number;
  commands: number;
}

export interface SessionTimeline {
  session_id: string;
  items: TimelineBucket[];
}

export interface CommandEvent {
  id?: string;
  session_id?: string;
  ts?: string;
  command: string;
  trigger: string;
  confidence: number;
  cooldown_ms: number;
  meta_json?: Record<string, unknown>;
}

export interface FaceMetricsEvent {
  frame_event_id: string;
  session_id: string;
  face_detected: boolean;
  confidence: number;
  yaw: number;
  pitch: number;
  roll: number;
  blink: boolean;
  backend?: string;
  features?: Record<string, number>;
}

export interface GazePointEvent {
  frame_event_id: string;
  session_id: string;
  x: number;
  y: number;
  confidence: number;
  source: string;
  page_id?: string | null;
}

export interface WsEnvelope<T = Record<string, unknown>> {
  type: string;
  timestamp?: string;
  data?: T;
  session_id?: string;
}
