"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface LocalTrackingPreviewProps {
  stream: MediaStream | null;
  width?: number;
  height?: number;
  status: "idle" | "loading" | "ready" | "blocked" | "error";
  error?: string | null;
  onRetry?: () => void;
  faceDetected: boolean;
  attentionDirection: "left" | "right" | "up" | "down" | "center";
  attentionSource: "eye_gaze" | "head_pose" | "idle";
  gazeRawX?: number | null;
  gazeRawY?: number | null;
  faceXNorm?: number | null;
  faceYNorm?: number | null;
  fps?: number | null;
  processingLatencyMs?: number | null;
}

export function LocalTrackingPreview({
  stream,
  width = 900,
  height = 500,
  status,
  error,
  onRetry,
  faceDetected,
  attentionDirection,
  attentionSource,
  gazeRawX,
  gazeRawY,
  faceXNorm,
  faceYNorm,
  fps,
  processingLatencyMs,
}: LocalTrackingPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gazeVisible = typeof gazeRawX === "number" && typeof gazeRawY === "number";
  const faceVisible = typeof faceXNorm === "number" && typeof faceYNorm === "number" && faceDetected;
  const loading = status === "idle" || status === "loading";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!stream) {
      video.pause();
      video.srcObject = null;
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // The status banner already surfaces camera state.
      });
    }

    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,10,22,0.94),rgba(3,7,18,0.92))]"
      style={{ width, height }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "h-full w-full object-cover transition duration-300",
          status === "ready" ? "opacity-100" : "opacity-30",
          "scale-x-[-1]",
        )}
      />

      <div className="pointer-events-none absolute inset-0">
        <GridOverlay />

        {faceVisible ? (
          <div
            className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-300/90 shadow-[0_0_18px_rgba(52,211,153,0.28)]"
            style={{
              left: `${(faceXNorm ?? 0.5) * 100}%`,
              top: `${(faceYNorm ?? 0.5) * 100}%`,
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-14 w-px -translate-x-1/2 -translate-y-1/2 bg-emerald-300/60" />
            <div className="absolute left-1/2 top-1/2 h-px w-14 -translate-x-1/2 -translate-y-1/2 bg-emerald-300/60" />
          </div>
        ) : null}

        {gazeVisible ? (
          <div
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-200/95 shadow-[0_0_18px_rgba(125,211,252,0.36)]"
            style={{
              left: `${(gazeRawX ?? 0.5) * 100}%`,
              top: `${(gazeRawY ?? 0.5) * 100}%`,
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-12 w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-200/60" />
            <div className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 -translate-y-1/2 bg-cyan-200/60" />
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,rgba(2,6,23,0.78),transparent)] px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/45">Browser Cam</p>
          <p className="mt-1 text-sm text-white/80">
            {loading
              ? "Inicializando tracking local..."
              : status === "blocked"
                ? "Permissao da camera bloqueada"
                : status === "error"
                  ? "Falha ao iniciar tracking"
                  : faceDetected
                    ? "Tracking local ativo"
                    : "Camera ativa, aguardando face"}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
          {attentionSource === "eye_gaze" ? `iris ${attentionDirection}` : `pose ${attentionDirection}`}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-[linear-gradient(0deg,rgba(2,6,23,0.86),transparent)] px-4 py-4 text-xs uppercase tracking-[0.18em] text-white/65">
        <span>{fps ? `${Math.round(fps)} fps local` : "-- fps"}</span>
        <span>{processingLatencyMs ? `${Math.round(processingLatencyMs)} ms proc` : "-- ms proc"}</span>
      </div>

      {error ? (
        <div className="absolute bottom-16 left-4 right-4 rounded-2xl border border-rose-400/20 bg-rose-400/12 px-4 py-3 text-sm text-rose-100">
          {error}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex rounded-full border border-rose-200/30 bg-rose-100/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-rose-50 transition hover:bg-rose-100/20"
            >
              tentar de novo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GridOverlay() {
  return (
    <>
      <div className="absolute inset-y-0 left-1/4 w-px bg-white/8" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-white/8" />
      <div className="absolute inset-x-0 top-1/4 h-px bg-white/8" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      <div className="absolute inset-x-0 top-3/4 h-px bg-white/8" />
    </>
  );
}
