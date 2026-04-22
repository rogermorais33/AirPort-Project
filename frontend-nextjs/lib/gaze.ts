import type { FaceMetricsEvent } from "@/lib/types";

export type AttentionDirection = "left" | "right" | "up" | "down" | "center";
export type AttentionSource = "eye_gaze" | "head_pose" | "idle";

export interface AttentionState {
  direction: AttentionDirection;
  source: AttentionSource;
  intensity: number;
  rawX: number;
  rawY: number;
  eyeTrackingActive: boolean;
}

export function deriveAttentionState(input: {
  faceMetrics: FaceMetricsEvent | null;
  centeredYaw: number;
  centeredPitch: number;
}): AttentionState {
  const features = input.faceMetrics?.features ?? {};
  const rawX = normalizeFeature(features.gaze_raw_x_norm, 0.5);
  const rawY = normalizeFeature(features.gaze_raw_y_norm, 0.5);
  const faceDetected = Boolean(input.faceMetrics?.face_detected);

  if (!faceDetected) {
    return {
      direction: "center",
      source: "idle",
      intensity: 0,
      rawX,
      rawY,
      eyeTrackingActive: false,
    };
  }

  const eyeTrackingActive = Number(features.iris_available ?? 0) >= 0.5;

  if (eyeTrackingActive) {
    const offsetX = rawX - 0.5;
    const offsetY = rawY - 0.5;
    const absX = Math.abs(offsetX);
    const absY = Math.abs(offsetY);
    const horizontalThreshold = 0.1;
    const verticalThreshold = 0.09;

    if (absX < horizontalThreshold && absY < verticalThreshold) {
      return {
        direction: "center",
        source: "eye_gaze",
        intensity: 0,
        rawX,
        rawY,
        eyeTrackingActive,
      };
    }

    if (absX >= absY) {
      return {
        direction: offsetX > 0 ? "right" : "left",
        source: "eye_gaze",
        intensity: clamp(absX / 0.28, 0, 1),
        rawX,
        rawY,
        eyeTrackingActive,
      };
    }

    return {
      direction: offsetY > 0 ? "down" : "up",
      source: "eye_gaze",
      intensity: clamp(absY / 0.24, 0, 1),
      rawX,
      rawY,
      eyeTrackingActive,
    };
  }

  const absYaw = Math.abs(input.centeredYaw);
  const absPitch = Math.abs(input.centeredPitch);
  const yawThreshold = 12;
  const pitchThreshold = 10;

  if (absYaw < yawThreshold && absPitch < pitchThreshold) {
    return {
      direction: "center",
      source: "head_pose",
      intensity: 0,
      rawX,
      rawY,
      eyeTrackingActive,
    };
  }

  if (absYaw >= absPitch) {
    return {
      direction: input.centeredYaw > 0 ? "right" : "left",
      source: "head_pose",
      intensity: clamp(absYaw / 28, 0, 1),
      rawX,
      rawY,
      eyeTrackingActive,
    };
  }

  return {
    direction: input.centeredPitch > 0 ? "up" : "down",
    source: "head_pose",
    intensity: clamp(absPitch / 22, 0, 1),
    rawX,
    rawY,
    eyeTrackingActive,
  };
}

function normalizeFeature(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
