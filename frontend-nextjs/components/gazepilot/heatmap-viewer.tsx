"use client";

import { useEffect, useRef } from "react";

interface HeatmapViewerProps {
  bins: number[][];
  maxBin: number;
}

export function HeatmapViewer({ bins, maxBin }: HeatmapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    if (bins.length === 0 || bins[0]?.length === 0) {
      return;
    }

    const rows = bins.length;
    const cols = bins[0].length;
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const value = bins[r]?.[c] ?? 0;
        const intensity = maxBin <= 0 ? 0 : value / maxBin;
        const red = Math.round(255 * intensity);
        const green = Math.round(120 + 80 * (1 - intensity));
        const alpha = Math.min(0.95, 0.1 + intensity * 0.85);

        ctx.fillStyle = `rgba(${red}, ${green}, 70, ${alpha})`;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let r = 0; r <= rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(width, r * cellH);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c += 1) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, height);
      ctx.stroke();
    }
  }, [bins, maxBin]);

  return <canvas ref={canvasRef} width={900} height={450} className="w-full rounded-2xl border border-zinc-800" />;
}
