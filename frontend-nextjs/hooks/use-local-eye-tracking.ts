"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FaceMetricsEvent, FrameProcessedEvent, GazePointEvent } from "@/lib/types";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DETECTION_INTERVAL_MS = 55;
const LEFT_EYE_INDICES = [33, 133, 159, 145, 160, 144, 158, 153, 173];
const RIGHT_EYE_INDICES = [362, 263, 386, 374, 387, 373, 385, 380, 398];
const IRIS_A_INDICES = [468, 469, 470, 471, 472];
const IRIS_B_INDICES = [473, 474, 475, 476, 477];

interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

interface Category {
  score: number;
  categoryName: string;
}

interface Classifications {
  categories: Category[];
}

interface FaceLandmarkerResult {
  faceLandmarks: NormalizedLandmark[][];
  faceBlendshapes: Classifications[];
}

interface FaceLandmarker {
  detectForVideo(videoFrame: HTMLVideoElement, timestamp: number): FaceLandmarkerResult;
  close(): void;
}

interface LocalTrackingState {
  faceMetrics: FaceMetricsEvent | null;
  gazePoint: GazePointEvent | null;
  lastFrame: FrameProcessedEvent | null;
  framesProcessed: number;
  blinkCount: number;
  lastBlinkAt: string | null;
  lastError: string | null;
  localStatus: "idle" | "loading" | "ready" | "blocked" | "error";
  localFps: number | null;
  processingLatencyMs: number | null;
}

interface LocalTrackingAnalysis {
  faceXNorm: number;
  faceYNorm: number;
  rawX: number;
  rawY: number;
  yaw: number;
  pitch: number;
  roll: number;
  confidence: number;
  blink: boolean;
  blinkScore: number;
  irisAvailable: boolean;
}

export interface LocalEyeTrackingData {
  previewStream: MediaStream | null;
  faceMetrics: FaceMetricsEvent | null;
  gazePoint: GazePointEvent | null;
  lastFrame: FrameProcessedEvent | null;
  framesProcessed: number;
  blinkCount: number;
  lastBlinkAt: string | null;
  lastError: string | null;
  wsStatus: string;
  pose: {
    yaw: number;
    pitch: number;
    roll: number;
    confidence: number;
    faceDetected: boolean;
    backend: string;
  };
  localStatus: "idle" | "loading" | "ready" | "blocked" | "error";
  localFps: number | null;
  processingLatencyMs: number | null;
  recenter: () => void;
  retry: () => void;
}

export function useLocalEyeTracking(enabled: boolean): LocalEyeTrackingData {
  const processingVideoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCounterRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastProcessedAtRef = useRef(0);
  const lastCompletedAtRef = useRef(0);
  const lastBlinkRef = useRef(false);
  const smoothedGazeRef = useRef<{ x: number; y: number } | null>(null);
  const neutralGazeRef = useRef<{ x: number; y: number } | null>(null);
  const needsRecenterRef = useRef(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [restartNonce, setRestartNonce] = useState(0);

  const [state, setState] = useState<LocalTrackingState>({
    faceMetrics: null,
    gazePoint: null,
    lastFrame: null,
    framesProcessed: 0,
    blinkCount: 0,
    lastBlinkAt: null,
    lastError: null,
    localStatus: "idle",
    localFps: null,
    processingLatencyMs: null,
  });

  const recenter = useCallback(() => {
    needsRecenterRef.current = true;
  }, []);

  const retry = useCallback(() => {
    setRestartNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      teardownStream(streamRef.current);
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      resetVideoElement(processingVideoRef.current);
      lastVideoTimeRef.current = -1;
      lastProcessedAtRef.current = 0;
      lastCompletedAtRef.current = 0;
      lastBlinkRef.current = false;
      neutralGazeRef.current = null;
      smoothedGazeRef.current = null;
      setPreviewStream(null);
      setState((current) => ({
        ...current,
        faceMetrics: null,
        gazePoint: null,
        lastFrame: null,
        localStatus: "idle",
        lastError: null,
        localFps: null,
        processingLatencyMs: null,
      }));
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let processingVideo: HTMLVideoElement | null = processingVideoRef.current;

    async function boot() {
      setState((current) => ({
        ...current,
        localStatus: "loading",
        lastError: null,
      }));

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador nao suporta camera em tempo real.");
        }

        if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          throw new Error("Browser Cam requer HTTPS ou localhost.");
        }

        const bundleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/vision_bundle.mjs";
        const { FaceLandmarker, FilesetResolver } = await import(
          /* webpackIgnore: true */ bundleUrl
        );

        if (cancelled) {
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setPreviewStream(stream);
        const video = getOrCreateProcessingVideo(processingVideoRef);
        processingVideo = video;
        await attachStreamToVideo(video, stream);

        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });

        if (cancelled) {
          landmarker.close();
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        landmarkerRef.current = landmarker;
        setState((current) => ({
          ...current,
          localStatus: "ready",
        }));

        const tick = () => {
          if (cancelled) {
            return;
          }

          const activeVideo = processingVideoRef.current;
          const activeLandmarker = landmarkerRef.current;
          if (!activeVideo || !activeLandmarker || activeVideo.readyState < 2) {
            rafId = window.requestAnimationFrame(tick);
            return;
          }

          const now = performance.now();
          const videoTime = activeVideo.currentTime;
          const canProcess =
            videoTime !== lastVideoTimeRef.current && now - lastProcessedAtRef.current >= DETECTION_INTERVAL_MS;

          if (canProcess) {
            const frameDeltaMs =
              lastCompletedAtRef.current > 0 ? now - lastCompletedAtRef.current : DETECTION_INTERVAL_MS;
            lastProcessedAtRef.current = now;
            lastVideoTimeRef.current = videoTime;
            const detectionStartedAt = performance.now();
            const result = activeLandmarker.detectForVideo(activeVideo, now);
            const detectionElapsedMs = performance.now() - detectionStartedAt;
            lastCompletedAtRef.current = performance.now();
            processResult(result, detectionElapsedMs, frameDeltaMs);
          }

          rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
      } catch (error) {
        if (cancelled) {
          return;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const message = error instanceof Error ? error.message : "Falha ao iniciar tracking local.";
        const normalized = normalizeLocalCameraError(error, message);
        const blocked = normalized.kind === "blocked";
        setState((current) => ({
          ...current,
          localStatus: blocked ? "blocked" : "error",
          lastError: normalized.message,
        }));
      }
    }

    function processResult(result: FaceLandmarkerResult, detectionElapsedMs: number, frameDeltaMs: number) {
      const nowIso = new Date().toISOString();
      const frameId = `local-${frameCounterRef.current + 1}`;
      frameCounterRef.current += 1;

      const landmarks = result.faceLandmarks?.[0];
      if (!landmarks) {
        lastBlinkRef.current = false;
        setState((current) => ({
          ...current,
          faceMetrics: {
            frame_event_id: frameId,
            session_id: "local-browser",
            face_detected: false,
            confidence: 0,
            yaw: 0,
            pitch: 0,
            roll: 0,
            blink: false,
            backend: "mediapipe-web",
            features: {
              iris_available: 0,
            },
          },
          gazePoint: null,
          lastFrame: {
            frame_event_id: frameId,
            session_id: "local-browser",
            status: "processed",
            latency_ms: detectionElapsedMs,
            age_ms: detectionElapsedMs,
            face_detected: false,
          },
          framesProcessed: current.framesProcessed + 1,
          processingLatencyMs: smoothNumber(current.processingLatencyMs, detectionElapsedMs, 0.28),
          localFps: smoothNumber(current.localFps, 1000 / Math.max(frameDeltaMs, 16), 0.18),
        }));
        return;
      }

      const analysis = analyzeLandmarks(landmarks, result.faceBlendshapes?.[0]);
      if (!analysis) {
        return;
      }

      if (!neutralGazeRef.current || needsRecenterRef.current) {
        neutralGazeRef.current = { x: analysis.rawX, y: analysis.rawY };
        needsRecenterRef.current = false;
      }

      const neutral = neutralGazeRef.current ?? { x: 0.5, y: 0.5 };
      const centeredRawX = clamp(analysis.rawX - neutral.x + 0.5, 0, 1);
      const centeredRawY = clamp(analysis.rawY - neutral.y + 0.5, 0, 1);
      const smoothedGaze = smoothPoint(smoothedGazeRef.current, { x: centeredRawX, y: centeredRawY }, 0.34);
      smoothedGazeRef.current = smoothedGaze;

      const blinkStarted = analysis.blink && !lastBlinkRef.current;
      lastBlinkRef.current = analysis.blink;

      const faceMetrics: FaceMetricsEvent = {
        frame_event_id: frameId,
        session_id: "local-browser",
        face_detected: true,
        confidence: analysis.confidence,
        yaw: analysis.yaw,
        pitch: analysis.pitch,
        roll: analysis.roll,
        blink: analysis.blink,
        backend: "mediapipe-web",
        features: {
          gaze_raw_x_norm: smoothedGaze.x,
          gaze_raw_y_norm: smoothedGaze.y,
          face_x_norm: analysis.faceXNorm,
          face_y_norm: analysis.faceYNorm,
          iris_available: analysis.irisAvailable ? 1 : 0,
          blink_score: analysis.blinkScore,
        },
      };

      const gazePoint: GazePointEvent = {
        frame_event_id: frameId,
        session_id: "local-browser",
        x: smoothedGaze.x,
        y: smoothedGaze.y,
        confidence: analysis.confidence,
        source: "browser_cam",
      };

      setState((current) => ({
        ...current,
        faceMetrics,
        gazePoint,
        lastFrame: {
          frame_event_id: frameId,
          session_id: "local-browser",
          status: "processed",
          latency_ms: detectionElapsedMs,
          age_ms: detectionElapsedMs,
          face_detected: true,
        },
        framesProcessed: current.framesProcessed + 1,
        blinkCount: blinkStarted ? current.blinkCount + 1 : current.blinkCount,
        lastBlinkAt: blinkStarted ? nowIso : current.lastBlinkAt,
        processingLatencyMs: smoothNumber(current.processingLatencyMs, detectionElapsedMs, 0.28),
        localFps: smoothNumber(current.localFps, 1000 / Math.max(frameDeltaMs, 16), 0.18),
      }));
    }

    void boot();

    return () => {
      cancelled = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      teardownStream(streamRef.current);
      streamRef.current = null;
      resetVideoElement(processingVideo);
      setPreviewStream(null);
    };
  }, [enabled, restartNonce]);

  const pose = useMemo(() => {
    const metrics = state.faceMetrics;
    return {
      yaw: metrics?.yaw ?? 0,
      pitch: metrics?.pitch ?? 0,
      roll: metrics?.roll ?? 0,
      confidence: metrics?.confidence ?? 0,
      faceDetected: Boolean(metrics?.face_detected),
      backend: metrics?.backend ?? "mediapipe-web",
    };
  }, [state.faceMetrics]);

  return {
    previewStream,
    faceMetrics: state.faceMetrics,
    gazePoint: state.gazePoint,
    lastFrame: state.lastFrame,
    framesProcessed: state.framesProcessed,
    blinkCount: state.blinkCount,
    lastBlinkAt: state.lastBlinkAt,
    lastError: state.lastError,
    wsStatus: state.localStatus === "ready" ? "browser-cam" : state.localStatus,
    pose,
    localStatus: state.localStatus,
    localFps: state.localFps,
    processingLatencyMs: state.processingLatencyMs,
    recenter,
    retry,
  };
}

function getOrCreateProcessingVideo(ref: MutableRefObject<HTMLVideoElement | null>) {
  if (ref.current) {
    return ref.current;
  }

  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "true");
  ref.current = video;
  return video;
}

async function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream) {
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;

  await waitForLoadedMetadata(video);

  try {
    await video.play();
  } catch {
    // The processing loop will retry on the next animation frame once metadata is ready.
  }
}

function waitForLoadedMetadata(video: HTMLVideoElement) {
  if (video.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const handleLoaded = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      resolve();
    };
    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
  });
}

function resetVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }
  video.pause();
  video.srcObject = null;
}

function teardownStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function normalizeLocalCameraError(error: unknown, fallbackMessage: string) {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError" || error.name === "SecurityError") {
      return {
        kind: "blocked" as const,
        message: "Permissao da camera negada. Libere a Browser Cam nas permissoes do site e tente novamente.",
      };
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return {
        kind: "error" as const,
        message: "A camera ja esta em uso por outro app ou navegador. Feche o app que estiver usando a webcam e tente novamente.",
      };
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return {
        kind: "error" as const,
        message: "Nenhuma camera foi encontrada neste dispositivo.",
      };
    }
    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return {
        kind: "error" as const,
        message: "A configuracao pedida para a camera nao foi suportada. Tente novamente para usar o fallback automatico.",
      };
    }
  }

  const text = fallbackMessage.toLowerCase();
  if (text.includes("https") || text.includes("secure")) {
    return {
      kind: "error" as const,
      message: "Browser Cam requer HTTPS ou localhost para funcionar.",
    };
  }
  if (text.includes("permission") || text.includes("denied")) {
    return {
      kind: "blocked" as const,
      message: "Permissao da camera negada. Libere a Browser Cam nas permissoes do site e tente novamente.",
    };
  }

  return {
    kind: "error" as const,
    message: fallbackMessage,
  };
}

function analyzeLandmarks(
  landmarks: NormalizedLandmark[],
  blendshapes?: Classifications,
): LocalTrackingAnalysis | null {
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const cheekLeft = landmarks[234];
  const cheekRight = landmarks[454];
  if (!nose || !forehead || !chin || !cheekLeft || !cheekRight) {
    return null;
  }

  const eyeA = buildBounds(landmarks, LEFT_EYE_INDICES);
  const eyeB = buildBounds(landmarks, RIGHT_EYE_INDICES);
  const irisA = averagePoint(landmarks, IRIS_A_INDICES);
  const irisB = averagePoint(landmarks, IRIS_B_INDICES);
  const irisAvailable = Boolean(irisA && irisB);

  const pairedEyes = pairEyes(eyeA, eyeB, irisA, irisB);
  const horizontalRatios = pairedEyes
    .map((item) => ratioWithin(item.iris?.x, item.eye.minX, item.eye.maxX))
    .filter((value): value is number => value !== null);
  const verticalRatios = pairedEyes
    .map((item) => ratioWithin(item.iris?.y, item.eye.minY, item.eye.maxY))
    .filter((value): value is number => value !== null);

  const avgRatioX = horizontalRatios.length > 0 ? average(horizontalRatios) : 0.5;
  const avgRatioY = verticalRatios.length > 0 ? average(verticalRatios) : 0.5;
  const rawX = clamp(1 - avgRatioX, 0, 1);
  const rawY = clamp(avgRatioY, 0, 1);

  const faceWidth = Math.max(Math.abs(cheekRight.x - cheekLeft.x), 0.0001);
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 0.0001);
  const faceCenterX = (cheekLeft.x + cheekRight.x) * 0.5;
  const faceCenterY = (forehead.y + chin.y) * 0.5;
  const yaw = clamp(-((nose.x - faceCenterX) / faceWidth) * 210, -42, 42);
  const pitch = clamp(((faceCenterY - nose.y) / faceHeight) * 190, -32, 32);

  const eyeCenterLeft = midpoint(landmarks[33], landmarks[133]);
  const eyeCenterRight = midpoint(landmarks[362], landmarks[263]);
  const roll = eyeCenterLeft && eyeCenterRight
    ? clamp((Math.atan2(eyeCenterRight.y - eyeCenterLeft.y, eyeCenterRight.x - eyeCenterLeft.x) * 180) / Math.PI, -35, 35)
    : 0;

  const blinkLeft = getBlendshapeScore(blendshapes, "eyeBlinkLeft");
  const blinkRight = getBlendshapeScore(blendshapes, "eyeBlinkRight");
  const earBlink = average([computeEar(landmarks, true), computeEar(landmarks, false)]);
  const blinkScore = Math.max(blinkLeft, blinkRight, clamp((0.24 - earBlink) / 0.12, 0, 1));
  const blink = blinkScore >= 0.36;

  return {
    faceXNorm: clamp(nose.x, 0, 1),
    faceYNorm: clamp(nose.y, 0, 1),
    rawX,
    rawY,
    yaw,
    pitch,
    roll,
    confidence: clamp((faceWidth * 2.4 + faceHeight * 1.4) * (irisAvailable ? 1 : 0.8), 0.45, 0.98),
    blink,
    blinkScore,
    irisAvailable,
  };
}

function buildBounds(landmarks: NormalizedLandmark[], indices: number[]) {
  const points = indices.map((index) => landmarks[index]).filter((point): point is NormalizedLandmark => Boolean(point));
  return {
    centerX: average(points.map((point) => point.x)),
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function pairEyes(
  eyeA: ReturnType<typeof buildBounds>,
  eyeB: ReturnType<typeof buildBounds>,
  irisA: { x: number; y: number } | null,
  irisB: { x: number; y: number } | null,
) {
  const irises = [irisA, irisB].filter((item): item is { x: number; y: number } => Boolean(item));
  return [eyeA, eyeB].map((eye) => ({
    eye,
    iris:
      irises.length === 0
        ? null
        : [...irises].sort((left, right) => Math.abs(left.x - eye.centerX) - Math.abs(right.x - eye.centerX))[0],
  }));
}

function averagePoint(landmarks: NormalizedLandmark[], indices: number[]) {
  const points = indices.map((index) => landmarks[index]).filter((point): point is NormalizedLandmark => Boolean(point));
  if (points.length === 0) {
    return null;
  }
  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
  };
}

function midpoint(a?: NormalizedLandmark, b?: NormalizedLandmark) {
  if (!a || !b) {
    return null;
  }
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function ratioWithin(value: number | undefined, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return clamp((value - min) / Math.max(max - min, 0.0001), 0, 1);
}

function getBlendshapeScore(blendshapes: Classifications | undefined, categoryName: string) {
  return (
    blendshapes?.categories.find((item) => item.categoryName === categoryName)?.score ??
    0
  );
}

function computeEar(landmarks: NormalizedLandmark[], leftSide: boolean) {
  const indices = leftSide ? [33, 160, 158, 133, 153, 144] : [362, 385, 387, 263, 373, 380];
  const points = indices.map((index) => landmarks[index]);
  if (points.some((point) => !point)) {
    return 0.28;
  }

  const [p1, p2, p3, p4, p5, p6] = points as NormalizedLandmark[];
  const vertical = distance(p2, p6) + distance(p3, p5);
  const horizontal = Math.max(distance(p1, p4), 0.0001);
  return vertical / (2 * horizontal);
}

function smoothPoint(
  previous: { x: number; y: number } | null,
  next: { x: number; y: number },
  factor: number,
) {
  if (!previous) {
    return next;
  }
  return {
    x: previous.x * (1 - factor) + next.x * factor,
    y: previous.y * (1 - factor) + next.y * factor,
  };
}

function smoothNumber(previous: number | null, next: number, factor: number) {
  if (previous === null || Number.isNaN(previous)) {
    return next;
  }
  return previous * (1 - factor) + next * factor;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
