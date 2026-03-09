"use client";

import { useEffect, useRef } from "react";

interface GazeOverlayProps {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  confidence?: number;
  blink?: boolean;
}

export function GazeOverlay({ width, height, x, y, confidence = 0, blink = false }: GazeOverlayProps) {
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

    if (x === null || y === null) {
      return;
    }

    const px = Math.max(0, Math.min(width, x));
    const py = Math.max(0, Math.min(height, y));
    let radius = 10 + confidence * 8;
    
    // Apply visual blink effect (shrink and change color)
    if (blink) {
      radius = Math.max(4, radius * 0.4);
    }

    const gradient = ctx.createRadialGradient(px, py, 2, px, py, radius + 18);
    
    if (blink) {
       gradient.addColorStop(0, "rgba(52, 211, 153, 0.95)"); // Brighter emerald when blinking
       gradient.addColorStop(1, "rgba(52, 211, 153, 0)");
    } else {
       gradient.addColorStop(0, "rgba(16, 185, 129, 0.85)");
       gradient.addColorStop(1, "rgba(16, 185, 129, 0)");
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, radius + 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = blink ? "#a7f3d0" : "#f4f4f5"; // change inner core color on blink
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = blink ? "#34d399" : "#10b981"; // change stroke color on blink
    ctx.lineWidth = blink ? 3 : 2;
    ctx.beginPath();
    ctx.arc(px, py, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }, [width, height, x, y, confidence]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full rounded-2xl border border-zinc-800" />;
}
