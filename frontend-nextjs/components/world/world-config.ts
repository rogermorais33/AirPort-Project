"use client";

import type { CameraRigState, DistrictSceneConfig, NpcDefinition, StaticColliderConfig, Vec3Tuple } from "@/components/world/world-types";

export const PLAYER_SPAWN: Vec3Tuple = [0, 1.05, 22];
export const INITIAL_PLAYER_HEADING = Math.PI;

export const WORLD_BOUNDS = {
  halfSize: 68,
  resetSize: 78,
  wallHeight: 7,
};

export const CAMERA_DEFAULT: CameraRigState = {
  yaw: 0.08,
  pitch: 0.42,
  distance: 10.5,
};

export const CAMERA_LIMITS = {
  minPitch: 0.18,
  maxPitch: 0.88,
  minDistance: 6.5,
  maxDistance: 16,
};

export const DISTRICT_SCENE_CONFIG: Record<string, DistrictSceneConfig> = {
  "blink-theater": {
    id: "blink-theater",
    theme: "#f59e0b",
    label: "cinema",
    kind: "theater",
    platformRadius: 6.4,
    beaconHeight: 7.6,
    ringRadius: 4.7,
  },
  "arcade-bay": {
    id: "arcade-bay",
    theme: "#d946ef",
    label: "arcade",
    kind: "arcade",
    platformRadius: 6.7,
    beaconHeight: 12,
    ringRadius: 5.2,
  },
  "signal-observatory": {
    id: "signal-observatory",
    theme: "#22d3ee",
    label: "signal",
    kind: "tower",
    platformRadius: 6.8,
    beaconHeight: 13.8,
    ringRadius: 5,
  },
  "vision-dock": {
    id: "vision-dock",
    theme: "#34d399",
    label: "dock",
    kind: "dock",
    platformRadius: 6.2,
    beaconHeight: 7.2,
    ringRadius: 4.5,
  },
  "command-cafe": {
    id: "command-cafe",
    theme: "#60a5fa",
    label: "command",
    kind: "cafe",
    platformRadius: 6,
    beaconHeight: 7.4,
    ringRadius: 4.2,
  },
  "latency-lab": {
    id: "latency-lab",
    theme: "#f472b6",
    label: "latency",
    kind: "lab",
    platformRadius: 6.4,
    beaconHeight: 11.2,
    ringRadius: 4.9,
  },
};

export const STATIC_WORLD_COLLIDERS: StaticColliderConfig[] = [
  { id: "central-core", position: [0, 1.25, 8], size: [3.2, 2.5, 3.2] },
  { id: "runway-tower-left", position: [-8.5, 2.2, 44], size: [2.2, 4.4, 2.2] },
  { id: "runway-tower-right", position: [8.5, 2.2, 44], size: [2.2, 4.4, 2.2] },
  { id: "observatory-rock-a", position: [38, 1.4, -17], size: [4.2, 2.8, 4.2] },
  { id: "dock-crate-stack", position: [-35, 1.1, 24], size: [4.8, 2.2, 3.2] },
];

export const NPCS: NpcDefinition[] = [
  {
    id: "guide-io",
    name: "Io",
    role: "Skyport Guide",
    path: [
      [-4.2, 0, 11.8],
      [-10.5, 0, 19.2],
      [-5.4, 0, 26.4],
      [2.8, 0, 21.6],
    ],
    speed: 1.2,
    waitRange: [1.6, 3.8],
    palette: {
      Purple: "#3b82f6",
      LightBlue: "#67e8f9",
      White: "#f8fafc",
      Skin: "#e8b892",
      Hair: "#1f2937",
    },
  },
  {
    id: "engineer-rin",
    name: "Rin",
    role: "Signal Engineer",
    path: [
      [20.5, 0, -5.5],
      [28.4, 0, -12],
      [34.2, 0, -5],
      [26.4, 0, 3],
    ],
    speed: 1.05,
    waitRange: [2, 4.4],
    palette: {
      Purple: "#0891b2",
      LightBlue: "#cffafe",
      White: "#f0fdfa",
      Skin: "#d6a06f",
      Hair: "#111827",
    },
  },
  {
    id: "host-nova",
    name: "Nova",
    role: "Arcade Host",
    path: [
      [-5, 0, -24],
      [3.5, 0, -27.5],
      [8.8, 0, -35.4],
      [-2.8, 0, -38],
    ],
    speed: 1.35,
    waitRange: [1.2, 3.2],
    palette: {
      Purple: "#d946ef",
      LightBlue: "#f5d0fe",
      White: "#fff7ed",
      Skin: "#f2c6a0",
      Hair: "#3b0764",
    },
  },
  {
    id: "barista-kai",
    name: "Kai",
    role: "Command Barista",
    path: [
      [2.8, 0, 27.2],
      [8.6, 0, 31.5],
      [1.2, 0, 38.4],
      [-6.2, 0, 31.5],
    ],
    speed: 0.95,
    waitRange: [2.5, 5],
    palette: {
      Purple: "#2563eb",
      LightBlue: "#93c5fd",
      White: "#e0f2fe",
      Skin: "#b9855f",
      Hair: "#312e81",
    },
  },
  {
    id: "dock-tech-mira",
    name: "Mira",
    role: "Vision Tech",
    path: [
      [-22, 0, 22],
      [-30.5, 0, 27.5],
      [-24.5, 0, 35.2],
      [-17.4, 0, 29],
    ],
    speed: 1.1,
    waitRange: [1.8, 3.6],
    palette: {
      Purple: "#10b981",
      LightBlue: "#a7f3d0",
      White: "#ecfdf5",
      Skin: "#e6b17e",
      Hair: "#064e3b",
    },
  },
];

export const PATH_POINTS: Vec3Tuple[] = [
  [0, 0, 8],
  [-30, 0, 6],
  [0, 0, -32],
  [30, 0, -4],
  [-24, 0, 30],
  [0, 0, 34],
  [24, 0, -30],
];
