"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CommandEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommandReplayLabProps {
  commands: CommandEvent[];
}

type ReplayTarget = "surface" | "window";
type ReplaySource = "session" | "demo";

const DEFAULT_STEP_DELAY_MS = 900;
const MIN_DELAY_MS = 250;
const MAX_DELAY_MS = 4000;
const SCROLL_RATIO = 0.72;

const DEMO_COMMANDS: CommandEvent[] = [
  {
    ts: "2026-03-11T21:00:00.000Z",
    command: "SCROLL_DOWN",
    trigger: "demonstração: inclinação para baixo",
    confidence: 0.94,
    cooldown_ms: 1000,
  },
  {
    ts: "2026-03-11T21:00:01.100Z",
    command: "SCROLL_DOWN",
    trigger: "demonstração: inclinação para baixo",
    confidence: 0.91,
    cooldown_ms: 1000,
  },
  {
    ts: "2026-03-11T21:00:02.400Z",
    command: "SCROLL_DOWN",
    trigger: "demonstração: inclinação para baixo",
    confidence: 0.97,
    cooldown_ms: 1000,
  },
  {
    ts: "2026-03-11T21:00:03.900Z",
    command: "SCROLL_UP",
    trigger: "demonstração: inclinação para cima",
    confidence: 0.88,
    cooldown_ms: 1000,
  },
  {
    ts: "2026-03-11T21:00:05.000Z",
    command: "SCROLL_DOWN",
    trigger: "demonstração: inclinação para baixo",
    confidence: 0.93,
    cooldown_ms: 1000,
  },
];

function getCommandTimestamp(command: CommandEvent): number | null {
  if (!command.ts) {
    return null;
  }

  const timestamp = new Date(command.ts).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getReplayDelayMs(
  commands: CommandEvent[],
  currentIndex: number,
  speed: number,
): number {
  const currentTs = getCommandTimestamp(commands[currentIndex]);
  const nextTs = getCommandTimestamp(commands[currentIndex + 1]);

  if (currentTs === null || nextTs === null) {
    return Math.round(DEFAULT_STEP_DELAY_MS / speed);
  }

  const rawDelay = Math.max(nextTs - currentTs, MIN_DELAY_MS);
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, Math.round(rawDelay / speed)));
}

export function CommandReplayLab({ commands }: CommandReplayLabProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [source, setSource] = useState<ReplaySource>("session");

  const sourceCommands = useMemo(() => {
    return source === "demo" ? DEMO_COMMANDS : commands;
  }, [commands, source]);

  const orderedCommands = useMemo(() => {
    return [...sourceCommands].sort((left, right) => {
      const leftTs = getCommandTimestamp(left) ?? 0;
      const rightTs = getCommandTimestamp(right) ?? 0;
      return leftTs - rightTs;
    });
  }, [sourceCommands]);

  const [target, setTarget] = useState<ReplayTarget>("surface");
  const [speed, setSpeed] = useState(1);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Pronto para reproduzir os comandos salvos da sessão.",
  );

  const activeCommand =
    activeIndex >= 0 && activeIndex < orderedCommands.length
      ? orderedCommands[activeIndex]
      : null;

  const applyCommand = useCallback((command: CommandEvent) => {
    const scrollDelta =
      target === "window"
        ? Math.round(window.innerHeight * SCROLL_RATIO)
        : Math.round((surfaceRef.current?.clientHeight ?? 420) * SCROLL_RATIO);

    if (command.command === "SCROLL_DOWN") {
      if (target === "window") {
        window.scrollBy({ top: scrollDelta, behavior: "smooth" });
      } else {
        surfaceRef.current?.scrollBy({ top: scrollDelta, behavior: "smooth" });
      }
      setStatusMessage(`Comando ${command.command} aplicado no alvo ${target === "window" ? "janela atual" : "superfície interna"}.`);
      return;
    }

    if (command.command === "SCROLL_UP") {
      if (target === "window") {
        window.scrollBy({ top: -scrollDelta, behavior: "smooth" });
      } else {
        surfaceRef.current?.scrollBy({ top: -scrollDelta, behavior: "smooth" });
      }
      setStatusMessage(`Comando ${command.command} aplicado no alvo ${target === "window" ? "janela atual" : "superfície interna"}.`);
      return;
    }

    setStatusMessage(
      `${command.command} foi identificado no replay, mas esta primeira versão aplica apenas ações de rolagem.`,
    );
  }, [target]);

  function handlePlay() {
    if (orderedCommands.length === 0) {
      setStatusMessage(
        source === "demo"
          ? "O modo de demonstração está vazio, o que não deveria acontecer."
          : "Não há comandos gravados nesta sessão para reproduzir. Troque para o modo de demonstração.",
      );
      return;
    }

    if (activeIndex >= orderedCommands.length - 1) {
      setActiveIndex(0);
    } else if (activeIndex < 0) {
      setActiveIndex(0);
    }

    setIsPlaying(true);
  }

  function handleReset() {
    setIsPlaying(false);
    setActiveIndex(-1);
    setStatusMessage("Replay reiniciado.");
    surfaceRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!isPlaying || activeIndex < 0 || activeIndex >= orderedCommands.length) {
      return;
    }

    const command = orderedCommands[activeIndex];
    applyCommand(command);

    if (activeIndex >= orderedCommands.length - 1) {
      setIsPlaying(false);
      setStatusMessage("Replay concluído.");
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => current + 1);
    }, getReplayDelayMs(orderedCommands, activeIndex, speed));

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, applyCommand, isPlaying, orderedCommands, speed]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-cyan-950/70 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.10),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/75">Laboratório de Replay</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">Reprodução de comandos salvos</p>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Reproduz os comandos gravados no banco sem precisar de ESP32 ou câmera. Use esta área
              para validar o comportamento de rolagem antes de integrar com PDF, aba do navegador ou hardware real.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Progresso</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {orderedCommands.length === 0
                ? "0/0"
                : `${Math.max(activeIndex + (activeCommand ? 1 : 0), 0)}/${orderedCommands.length}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Fonte dos comandos
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as ReplaySource);
                setIsPlaying(false);
                setActiveIndex(-1);
              }}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="session">Sessão atual</option>
              <option value="demo">Demonstração local</option>
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            Alvo do replay
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value as ReplayTarget)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="surface">Superfície interna</option>
              <option value="window">Janela atual</option>
            </select>
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Velocidade
            <select
              value={String(speed)}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={handlePlay}>
            {isPlaying ? "Reiniciar fluxo" : "Iniciar replay"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsPlaying(false)}>
            Pausar
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            Resetar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              applyCommand({
                command: "SCROLL_DOWN",
                trigger: "teste manual",
                confidence: 1,
                cooldown_ms: 0,
              })
            }
          >
            Testar scroll para baixo
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              applyCommand({
                command: "SCROLL_UP",
                trigger: "teste manual",
                confidence: 1,
                cooldown_ms: 0,
              })
            }
          >
            Testar scroll para cima
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-900/70 bg-cyan-950/10 px-3 py-2 text-sm text-cyan-100">
          {statusMessage}
        </div>

        {source === "session" && orderedCommands.length === 0 ? (
          <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/10 px-3 py-2 text-sm text-amber-200">
            Esta sessão ainda não tem comandos salvos. Use a fonte <strong>Demonstração local</strong> para testar
            o replay agora mesmo.
          </div>
        ) : null}

        <div
          ref={surfaceRef}
          className="mt-4 h-[420px] overflow-y-auto rounded-2xl border border-zinc-800 bg-[linear-gradient(180deg,rgba(10,10,15,0.95),rgba(12,20,35,0.92))] p-5"
        >
          <div className="space-y-8">
            {Array.from({ length: 18 }, (_, index) => (
              <article key={index} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Bloco {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-lg font-semibold text-zinc-100">
                  Superfície de leitura para validar o replay de scroll
                </h3>
                <p className="text-sm leading-7 text-zinc-400">
                  Este painel existe para você provar que os comandos persistidos na tabela <code>commands</code>
                  conseguem virar comportamento concreto no navegador. Quando o replay aplicar
                  <code>SCROLL_DOWN</code> ou <code>SCROLL_UP</code>, a rolagem desta superfície deve acompanhar o ritmo
                  dos eventos gravados na sessão.
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-sm font-semibold text-zinc-100">Fila do replay</p>
        <p className="mt-1 text-sm text-zinc-400">
          {source === "demo"
            ? "Comandos sintéticos locais para validar o comportamento do scroll sem depender da API."
            : "Os comandos são lidos do histórico da sessão e reproduzidos em ordem cronológica."}
        </p>

        <div className="mt-4 space-y-2">
          {orderedCommands.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-4 text-sm text-zinc-500">
              Esta sessão ainda não tem comandos salvos.
            </div>
          ) : (
            orderedCommands.map((command, index) => (
              <div
                key={`${command.ts ?? "command"}-${index}`}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  activeIndex === index
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-950/70",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-emerald-300">{command.command}</span>
                  <span className="text-xs text-zinc-500">
                    {(command.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{command.trigger}</p>
                {command.ts ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {new Date(command.ts).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
