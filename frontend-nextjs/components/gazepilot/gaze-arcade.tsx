"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Trophy } from "lucide-react";

import type { AttentionDirection, AttentionSource } from "@/lib/gaze";
import { cn } from "@/lib/utils";

interface GazeArcadeProps {
  direction: AttentionDirection;
  source: AttentionSource;
  signalStrength: number;
  active: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface ArcadeState {
  player: Position;
  playerDirection: AttentionDirection;
  ghost: Position;
  ghostDirection: AttentionDirection;
  pellets: Set<string>;
  score: number;
  bestScore: number;
  lives: number;
  level: number;
  message: string;
}

const MAZE = [
  "###############",
  "#.............#",
  "#.###.###.###.#",
  "#...#.....#...#",
  "#.#.#.###.#.#.#",
  "#.#.........#.#",
  "#.###.#.#.###.#",
  "#.....#.#.....#",
  "#.###.#.#.###.#",
  "#.............#",
  "###############",
];

const DIRECTIONS: AttentionDirection[] = ["up", "right", "down", "left"];
const PLAYER_START = { x: 1, y: 1 };
const GHOST_START = { x: 13, y: 9 };

export function GazeArcade({ direction, source, signalStrength, active }: GazeArcadeProps) {
  const desiredDirectionRef = useRef<AttentionDirection>("right");
  const [game, setGame] = useState<ArcadeState>(() => createInitialState());

  useEffect(() => {
    if (direction !== "center") {
      desiredDirectionRef.current = direction;
    }
  }, [direction]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setGame((current) => advanceGame(current, desiredDirectionRef.current, active));
    }, 185);

    return () => {
      window.clearInterval(id);
    };
  }, [active]);

  const cells = useMemo(() => {
    const items: ReactNode[] = [];

    for (let y = 0; y < MAZE.length; y += 1) {
      for (let x = 0; x < MAZE[0].length; x += 1) {
        const cellKey = keyFor(x, y);
        const isWallCell = isWall(x, y);
        const hasPellet = game.pellets.has(cellKey);
        const hasPlayer = game.player.x === x && game.player.y === y;
        const hasGhost = game.ghost.x === x && game.ghost.y === y;

        items.push(
          <div
            key={cellKey}
            className={cn(
              "relative aspect-square rounded-[8px] border border-transparent",
              isWallCell
                ? "bg-[linear-gradient(180deg,rgba(34,211,238,0.32),rgba(8,47,73,0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                : "bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]",
            )}
          >
            {!isWallCell && hasPellet ? (
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_18px_rgba(253,224,71,0.58)]" />
            ) : null}
            {hasGhost ? (
              <div className="absolute inset-[18%] rounded-[10px] bg-[linear-gradient(180deg,#fb7185,#be123c)] shadow-[0_0_24px_rgba(244,63,94,0.35)]">
                <div className="absolute left-[22%] top-[26%] h-2 w-2 rounded-full bg-white" />
                <div className="absolute right-[22%] top-[26%] h-2 w-2 rounded-full bg-white" />
              </div>
            ) : null}
            {hasPlayer ? (
              <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_30%_30%,#fde68a,#f59e0b_72%)] shadow-[0_0_28px_rgba(245,158,11,0.45)]" />
            ) : null}
          </div>,
        );
      }
    }

    return items;
  }, [game.ghost.x, game.ghost.y, game.pellets, game.player.x, game.player.y]);

  return (
    <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(20,15,35,0.96),rgba(6,10,22,0.95))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.42)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/70">Gaze Arcade</p>
          <p className="mt-2 text-2xl font-semibold text-white">Pac-room controlado pelo olhar</p>
        </div>
        <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-3 text-fuchsia-100">
          <Gamepad2 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <StatBubble label="Score" value={String(game.score)} />
        <StatBubble label="Best" value={String(game.bestScore)} />
        <StatBubble label="Lives" value={String(game.lives)} />
        <StatBubble label="Level" value={String(game.level)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-white/70">
          steering: {direction === "center" ? "mantendo rota" : translateDirection(direction)}
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
          input: {source === "eye_gaze" ? "íris" : "cabeça"}
        </span>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
          drive {(signalStrength * 100).toFixed(0)}%
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.14),transparent_32%),linear-gradient(180deg,rgba(6,10,22,0.92),rgba(3,7,18,0.92))] p-3">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${MAZE[0].length}, minmax(0, 1fr))` }}>
          {cells}
        </div>
        {!active ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center">
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Paused</p>
              <p className="mt-2 text-base text-white">Ative a face no preview para dirigir a nave.</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Round status</p>
          <p className="mt-1 text-white">{game.message}</p>
        </div>
        <div className="flex items-center gap-2 text-amber-100">
          <Trophy className="h-4 w-4" />
          <span className="text-sm">olhe para os lados para virar e limpe o mapa</span>
        </div>
      </div>
    </div>
  );
}

function StatBubble({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function createInitialState(bestScore = 0): ArcadeState {
  return {
    player: { ...PLAYER_START },
    playerDirection: "right",
    ghost: { ...GHOST_START },
    ghostDirection: "left",
    pellets: createPellets(),
    score: 0,
    bestScore,
    lives: 3,
    level: 1,
    message: "Colete tudo sem tocar no drone.",
  };
}

function createPellets(): Set<string> {
  const pellets = new Set<string>();

  for (let y = 0; y < MAZE.length; y += 1) {
    for (let x = 0; x < MAZE[0].length; x += 1) {
      if (!isWall(x, y)) {
        pellets.add(keyFor(x, y));
      }
    }
  }

  pellets.delete(keyFor(PLAYER_START.x, PLAYER_START.y));
  pellets.delete(keyFor(GHOST_START.x, GHOST_START.y));
  return pellets;
}

function advanceGame(current: ArcadeState, desiredDirection: AttentionDirection, active: boolean): ArcadeState {
  if (!active) {
    return current;
  }

  let playerDirection = current.playerDirection;
  if (desiredDirection !== "center" && canMove(current.player, desiredDirection)) {
    playerDirection = desiredDirection;
  }

  const player = canMove(current.player, playerDirection)
    ? move(current.player, playerDirection)
    : current.player;

  const pellets = new Set(current.pellets);
  const pelletKey = keyFor(player.x, player.y);
  let score = current.score;
  let message = current.message;

  if (pellets.delete(pelletKey)) {
    score += 10;
    message = "Bom trajeto. Continue limpando o corredor.";
  }

  const ghostDirection = chooseGhostDirection(current.ghost, player, current.ghostDirection);
  const ghost = canMove(current.ghost, ghostDirection) ? move(current.ghost, ghostDirection) : current.ghost;

  if (ghost.x === player.x && ghost.y === player.y) {
    const remainingLives = current.lives - 1;
    if (remainingLives <= 0) {
      return {
        ...createInitialState(Math.max(current.bestScore, score)),
        message: "Round resetado. O drone te alcançou.",
      };
    }

    return {
      ...current,
      player: { ...PLAYER_START },
      playerDirection: "right",
      ghost: { ...GHOST_START },
      ghostDirection: "left",
      score,
      bestScore: Math.max(current.bestScore, score),
      lives: remainingLives,
      message: "Quase. Reposicionando a nave.",
    };
  }

  if (pellets.size === 0) {
    return {
      player: { ...PLAYER_START },
      playerDirection,
      ghost: { ...GHOST_START },
      ghostDirection: "left",
      pellets: createPellets(),
      score: score + 100,
      bestScore: Math.max(current.bestScore, score + 100),
      lives: current.lives,
      level: current.level + 1,
      message: "Mapa limpo. Novo setor liberado.",
    };
  }

  return {
    ...current,
    player,
    playerDirection,
    ghost,
    ghostDirection,
    pellets,
    score,
    bestScore: Math.max(current.bestScore, score),
    message,
  };
}

function chooseGhostDirection(position: Position, target: Position, current: AttentionDirection): AttentionDirection {
  const options = DIRECTIONS.filter((item) => canMove(position, item));
  if (options.length === 0) {
    return current;
  }

  const sorted = [...options].sort((left, right) => {
    const leftPos = move(position, left);
    const rightPos = move(position, right);
    const leftDistance = Math.abs(target.x - leftPos.x) + Math.abs(target.y - leftPos.y);
    const rightDistance = Math.abs(target.x - rightPos.x) + Math.abs(target.y - rightPos.y);
    return leftDistance - rightDistance;
  });

  return Math.random() < 0.7 ? sorted[0] : sorted[Math.min(1, sorted.length - 1)];
}

function canMove(position: Position, direction: AttentionDirection): boolean {
  if (direction === "center") {
    return false;
  }
  const next = move(position, direction);
  return !isWall(next.x, next.y);
}

function move(position: Position, direction: AttentionDirection): Position {
  switch (direction) {
    case "up":
      return { x: position.x, y: position.y - 1 };
    case "down":
      return { x: position.x, y: position.y + 1 };
    case "left":
      return { x: position.x - 1, y: position.y };
    case "right":
      return { x: position.x + 1, y: position.y };
    default:
      return position;
  }
}

function isWall(x: number, y: number): boolean {
  if (y < 0 || y >= MAZE.length || x < 0 || x >= MAZE[0].length) {
    return true;
  }
  return MAZE[y]?.[x] === "#";
}

function keyFor(x: number, y: number): string {
  return `${x}:${y}`;
}

function translateDirection(direction: AttentionDirection): string {
  switch (direction) {
    case "left":
      return "esquerda";
    case "right":
      return "direita";
    case "up":
      return "cima";
    case "down":
      return "baixo";
    default:
      return "centro";
  }
}
