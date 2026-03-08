"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface LivePreviewProps {
  sessionId: string | null;
  width?: number;
  height?: number;
  yaw: number;
  pitch: number;
  roll: number;
  faceDetected: boolean;
  suggestedAction: string | null;
  faceXNorm?: number | null;
  faceYNorm?: number | null;
}

export function LivePreview({
  sessionId,
  width = 900,
  height = 500,
  yaw,
  pitch,
  roll,
  faceDetected,
  suggestedAction,
  faceXNorm,
  faceYNorm,
}: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef({
    yaw,
    pitch,
    roll,
    faceDetected,
    suggestedAction,
    faceXNorm: faceXNorm ?? null,
    faceYNorm: faceYNorm ?? null,
  });
  const hasRenderedFrameRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "waiting" | "ok">("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);

  const label = useMemo(() => {
    if (!sessionId) {
      return "Sem sessão ativa";
    }
    if (status === "waiting") {
      return "Aguardando frame da sessão...";
    }
    if (!faceDetected) {
      return "Frame recebido, sem face detectada";
    }
    return "Detecção de face ativa";
  }, [faceDetected, sessionId, status]);

  useEffect(() => {
    metricsRef.current = {
      yaw,
      pitch,
      roll,
      faceDetected,
      suggestedAction,
      faceXNorm: faceXNorm ?? null,
      faceYNorm: faceYNorm ?? null,
    };
  }, [faceDetected, faceXNorm, faceYNorm, pitch, roll, suggestedAction, yaw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let stopped = false;
    let timer: number | null = null;

    const drawPlaceholder = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(212, 212, 216, 0.2)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i += 1) {
        const gx = (width / 5) * i;
        const gy = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
    };

    const drawHud = () => {
      const metrics = metricsRef.current;
      ctx.fillStyle = "rgba(9, 9, 11, 0.75)";
      ctx.fillRect(0, 0, width, 40);
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "600 12px var(--font-body)";
      ctx.fillText(
        `yaw ${metrics.yaw.toFixed(1)} | pitch ${metrics.pitch.toFixed(1)} | roll ${metrics.roll.toFixed(1)}`,
        12,
        24,
      );

      const actionText = metrics.suggestedAction
        ? `acao candidata: ${metrics.suggestedAction}`
        : "acao candidata: nenhuma";
      const textWidth = ctx.measureText(actionText).width;
      ctx.fillStyle = metrics.suggestedAction ? "#34d399" : "#a1a1aa";
      ctx.fillText(actionText, Math.max(12, width - textWidth - 12), 24);
    };

    const drawFaceMarker = () => {
      const metrics = metricsRef.current;
      if (!metrics.faceDetected) {
        return;
      }
      if (typeof metrics.faceXNorm !== "number" || typeof metrics.faceYNorm !== "number") {
        return;
      }

      const x = Math.max(0, Math.min(width, metrics.faceXNorm * width));
      const y = Math.max(0, Math.min(height, metrics.faceYNorm * height));

      ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 18, y);
      ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y + 18);
      ctx.stroke();
    };

    const drawFrame = (img: HTMLImageElement) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      const scale = Math.max(width / img.width, height / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const ox = (width - drawW) / 2;
      const oy = (height - drawH) / 2;
      ctx.drawImage(img, ox, oy, drawW, drawH);

      drawHud();
      drawFaceMarker();
    };

    const tick = async () => {
      if (stopped) {
        return;
      }
      if (!sessionId) {
        setStatus("idle");
        drawPlaceholder();
        drawHud();
        timer = window.setTimeout(() => void tick(), 350);
        return;
      }

      try {
        const response = await fetch(`/api/proxy/v1/sessions/${sessionId}/preview`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setStatus("waiting");
          if (!hasRenderedFrameRef.current) {
            drawPlaceholder();
          }
          drawHud();
          timer = window.setTimeout(() => void tick(), 300);
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          drawFrame(img);
          URL.revokeObjectURL(objectUrl);
          setStatus("ok");
          hasRenderedFrameRef.current = true;
          setLastUpdateAt(Date.now());
          timer = window.setTimeout(() => void tick(), 120);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          setStatus("waiting");
          if (!hasRenderedFrameRef.current) {
            drawPlaceholder();
          }
          drawHud();
          timer = window.setTimeout(() => void tick(), 300);
        };
        img.src = objectUrl;
      } catch {
        setStatus("waiting");
        if (!hasRenderedFrameRef.current) {
          drawPlaceholder();
        }
        drawHud();
        timer = window.setTimeout(() => void tick(), 400);
      }
    };

    hasRenderedFrameRef.current = false;
    drawPlaceholder();
    drawHud();
    void tick();

    return () => {
      stopped = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [height, sessionId, width]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-2xl border border-zinc-800" />
      <p className="mt-2 text-xs text-zinc-400">
        {label}
        {lastUpdateAt ? ` • último frame: ${new Date(lastUpdateAt).toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}
