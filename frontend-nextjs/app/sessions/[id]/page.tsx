"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CommandLog } from "@/components/gazepilot/command-log";
import { HeatmapViewer } from "@/components/gazepilot/heatmap-viewer";
import {
  getSessionCommands,
  getSessionHeatmap,
  getSessionReport,
  getSessionTimeline,
} from "@/lib/api";
import type { CommandEvent, SessionHeatmap, SessionReport, SessionTimeline } from "@/lib/types";

export default function SessionDetailsPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [report, setReport] = useState<SessionReport | null>(null);
  const [heatmap, setHeatmap] = useState<SessionHeatmap | null>(null);
  const [timeline, setTimeline] = useState<SessionTimeline | null>(null);
  const [commands, setCommands] = useState<CommandEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    Promise.all([
      getSessionReport(sessionId),
      getSessionHeatmap(sessionId),
      getSessionTimeline(sessionId),
      getSessionCommands(sessionId),
    ])
      .then(([reportData, heatmapData, timelineData, commandData]) => {
        setReport(reportData);
        setHeatmap(heatmapData);
        setTimeline(timelineData);
        setCommands(commandData);
      })
      .catch((err: Error) => setError(err.message));
  }, [sessionId]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Session Report</h1>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {report ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Frames</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-100">{report.frames_total}</p>
            <p className="text-sm text-zinc-400">done: {report.frames_done} | error: {report.frames_error}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Commands</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-100">{report.commands_total}</p>
            <p className="text-sm text-zinc-400">latency média: {report.avg_latency_ms?.toFixed(1) ?? "-"} ms</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Face Detection</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-100">
              {(report.face_detection_rate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-zinc-400">duração: {Math.round(report.duration_s)}s</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
        <p className="mb-3 text-sm font-semibold">Heatmap</p>
        {heatmap ? (
          <>
            <HeatmapViewer bins={heatmap.bins} maxBin={heatmap.max_bin} />
            <p className="mt-2 text-sm text-zinc-400">Total de pontos: {heatmap.total_points}</p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Carregando heatmap...</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="mb-3 text-sm font-semibold">Timeline (frames/comandos por segundo)</p>
          <div className="max-h-80 overflow-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">Frames</th>
                  <th className="px-3 py-2 text-left">Commands</th>
                </tr>
              </thead>
              <tbody>
                {timeline?.items.map((item) => (
                  <tr key={item.ts} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-zinc-300">{new Date(item.ts).toLocaleString()}</td>
                    <td className="px-3 py-2 text-zinc-300">{item.frames}</td>
                    <td className="px-3 py-2 text-zinc-300">{item.commands}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="mb-3 text-sm font-semibold">Command Log</p>
          <CommandLog commands={commands} />
        </div>
      </section>
    </div>
  );
}
