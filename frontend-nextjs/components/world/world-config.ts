"use client";

import type {
  CameraRigState,
  DistrictSceneConfig,
  NpcDefinition,
  StaticColliderConfig,
  Vec3Tuple,
  WorldBuildingDefinition,
  WorldLampDefinition,
  WorldPropDefinition,
  WorldTreeDefinition,
} from "@/components/world/world-types";

export const PLAYER_SPAWN: Vec3Tuple = [0, 1.05, 34];
export const INITIAL_PLAYER_HEADING = Math.PI;

export const WORLD_BOUNDS = {
  halfSize: 96,
  resetSize: 116,
  wallHeight: 9,
};

export const CAMERA_DEFAULT: CameraRigState = {
  yaw: 0.08,
  pitch: 0.36,
  distance: 12.8,
};

export const CAMERA_LIMITS = {
  minPitch: 0.18,
  maxPitch: 0.9,
  minDistance: 6.2,
  maxDistance: 18.5,
};

export const DISTRICT_SCENE_CONFIG: Record<string, DistrictSceneConfig> = {
  "blink-theater": {
    id: "blink-theater",
    theme: "#f59e0b",
    label: "cinema",
    kind: "theater",
    platformRadius: 9.4,
    beaconHeight: 10.2,
    ringRadius: 6.9,
  },
  "arcade-bay": {
    id: "arcade-bay",
    theme: "#d946ef",
    label: "arcade",
    kind: "arcade",
    platformRadius: 9.8,
    beaconHeight: 15.8,
    ringRadius: 7.4,
  },
  "signal-observatory": {
    id: "signal-observatory",
    theme: "#22d3ee",
    label: "signal",
    kind: "tower",
    platformRadius: 9.6,
    beaconHeight: 18.5,
    ringRadius: 7.2,
  },
  "vision-dock": {
    id: "vision-dock",
    theme: "#34d399",
    label: "dock",
    kind: "dock",
    platformRadius: 9.2,
    beaconHeight: 9.6,
    ringRadius: 6.6,
  },
  "command-cafe": {
    id: "command-cafe",
    theme: "#60a5fa",
    label: "command",
    kind: "cafe",
    platformRadius: 9.3,
    beaconHeight: 9.8,
    ringRadius: 6.6,
  },
  "latency-lab": {
    id: "latency-lab",
    theme: "#f472b6",
    label: "latency",
    kind: "lab",
    platformRadius: 9.6,
    beaconHeight: 15.2,
    ringRadius: 7.1,
  },
};

export const PATH_POINTS: Vec3Tuple[] = [
  [0, 0, 10],
  [-52, 0, 8],
  [0, 0, -58],
  [52, 0, -6],
  [-52, 0, 54],
  [0, 0, 58],
  [48, 0, -52],
  [0, 0, 34],
];

export const WORLD_BUILDINGS: WorldBuildingDefinition[] = [
  {
    id: "skyport-atrium",
    position: [0, 0, 8],
    size: [11, 10.5, 10],
    color: "#27455f",
    accent: "#7dd3fc",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-a.glb",
    roof: "beacon",
  },
  {
    id: "skyport-west-terminal",
    position: [-14, 0, 12],
    size: [10, 6.8, 14],
    color: "#38566d",
    accent: "#bae6fd",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-b.glb",
    rotationY: -0.08,
    roof: "flat",
  },
  {
    id: "skyport-east-terminal",
    position: [14, 0, 12],
    size: [10, 6.8, 14],
    color: "#314f66",
    accent: "#bae6fd",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-a.glb",
    rotationY: 0.08,
    roof: "flat",
  },
  {
    id: "north-arrivals-hall",
    position: [0, 0, -10],
    size: [18, 7.2, 8],
    color: "#40546b",
    accent: "#dbeafe",
    modelPath: "/models/kenney-commercial/building-h.glb",
    roof: "garden",
  },
  {
    id: "signal-data-tower-a",
    position: [35, 0, -20],
    size: [9, 22, 9],
    color: "#24566c",
    accent: "#67e8f9",
    modelPath: "/models/kenney-commercial/building-skyscraper-d.glb",
    roof: "radar",
  },
  {
    id: "signal-data-tower-b",
    position: [65, 0, -16],
    size: [8.4, 19, 8.4],
    color: "#376477",
    accent: "#a5f3fc",
    modelPath: "/models/kenney-commercial/building-skyscraper-b.glb",
    rotationY: 0.18,
    roof: "antenna",
  },
  {
    id: "signal-media-block",
    position: [40, 0, 15],
    size: [13, 12, 9],
    color: "#41687a",
    accent: "#bae6fd",
    modelPath: "/models/kenney-commercial/building-m.glb",
    rotationY: -0.18,
    roof: "flat",
  },
  {
    id: "signal-service-block",
    position: [64, 0, 11],
    size: [12, 9.5, 10],
    color: "#456775",
    accent: "#cffafe",
    modelPath: "/models/kenney-commercial/building-h.glb",
    roof: "garden",
  },
  {
    id: "latency-test-tower",
    position: [31, 0, -59],
    size: [9.5, 19, 9.5],
    color: "#5a4168",
    accent: "#fbcfe8",
    modelPath: "/models/kenney-commercial/building-skyscraper-b.glb",
    rotationY: -0.2,
    roof: "antenna",
  },
  {
    id: "latency-hardware-lab",
    position: [62, 0, -42],
    size: [13, 11.4, 10],
    color: "#614761",
    accent: "#f9a8d4",
    modelPath: "/models/kenney-commercial/building-a.glb",
    roof: "radar",
  },
  {
    id: "arcade-neon-tower-left",
    position: [-19, 0, -55],
    size: [8.8, 18, 8.8],
    color: "#4d3a75",
    accent: "#f0abfc",
    modelPath: "/models/kenney-commercial/building-skyscraper-b.glb",
    roof: "beacon",
  },
  {
    id: "arcade-neon-tower-right",
    position: [19, 0, -55],
    size: [8.8, 18, 8.8],
    color: "#45316b",
    accent: "#c084fc",
    modelPath: "/models/kenney-commercial/building-skyscraper-d.glb",
    rotationY: 0.12,
    roof: "beacon",
  },
  {
    id: "arcade-food-hall",
    position: [-25, 0, -36],
    size: [13, 8, 10],
    color: "#60476b",
    accent: "#f5d0fe",
    modelPath: "/models/kenney-commercial/building-m.glb",
    rotationY: 0.22,
    roof: "flat",
  },
  {
    id: "arcade-service-hall",
    position: [24, 0, -37],
    size: [13, 7.8, 10],
    color: "#503f69",
    accent: "#e879f9",
    modelPath: "/models/kenney-commercial/building-a.glb",
    rotationY: -0.2,
    roof: "flat",
  },
  {
    id: "blink-front-house",
    position: [-38, 0, -8],
    size: [12, 8.6, 10],
    color: "#7a5942",
    accent: "#fde68a",
    modelPath: "/models/kenney-commercial/building-a.glb",
    rotationY: -0.18,
    roof: "flat",
  },
  {
    id: "blink-studio-backlot",
    position: [-69, 0, 4],
    size: [12, 9.4, 10],
    color: "#725136",
    accent: "#fbbf24",
    modelPath: "/models/kenney-commercial/building-h.glb",
    rotationY: 0.12,
    roof: "beacon",
  },
  {
    id: "blink-reel-lofts",
    position: [-55, 0, 27],
    size: [12, 10.8, 9],
    color: "#6f4c39",
    accent: "#fed7aa",
    modelPath: "/models/kenney-commercial/building-m.glb",
    roof: "garden",
  },
  {
    id: "vision-warehouse-west",
    position: [-72, 0, 45],
    size: [13, 7.8, 12],
    color: "#2d6a5d",
    accent: "#a7f3d0",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-b.glb",
    rotationY: 0.12,
    roof: "flat",
  },
  {
    id: "vision-camera-hall",
    position: [-40, 0, 71],
    size: [14, 8.6, 10],
    color: "#2f6558",
    accent: "#bbf7d0",
    modelPath: "/models/kenney-commercial/building-h.glb",
    rotationY: -0.2,
    roof: "radar",
  },
  {
    id: "vision-pier-control",
    position: [-68, 0, 69],
    size: [11, 9.2, 9],
    color: "#2f5f60",
    accent: "#99f6e4",
    modelPath: "/models/kenney-commercial/building-m.glb",
    roof: "antenna",
  },
  {
    id: "command-lounge-left",
    position: [-18, 0, 49],
    size: [12, 7.4, 10],
    color: "#335b7f",
    accent: "#bfdbfe",
    modelPath: "/models/kenney-commercial/building-h.glb",
    rotationY: -0.08,
    roof: "garden",
  },
  {
    id: "command-lounge-right",
    position: [18, 0, 49],
    size: [12, 7.4, 10],
    color: "#2d5274",
    accent: "#bfdbfe",
    modelPath: "/models/kenney-commercial/building-a.glb",
    rotationY: 0.08,
    roof: "flat",
  },
  {
    id: "command-relay-hotel",
    position: [0, 0, 78],
    size: [15, 12.8, 11],
    color: "#365f82",
    accent: "#93c5fd",
    modelPath: "/models/kenney-commercial/building-m.glb",
    roof: "antenna",
  },
  {
    id: "garden-residence-a",
    position: [-28, 0, 31],
    size: [8, 6.2, 8],
    color: "#476a59",
    accent: "#bbf7d0",
    modelPath: "/models/kenney-suburban/building-type-h.glb",
    rotationY: 0.24,
    roof: "garden",
  },
  {
    id: "garden-residence-b",
    position: [30, 0, 33],
    size: [8, 6.2, 8],
    color: "#48615b",
    accent: "#bae6fd",
    modelPath: "/models/kenney-suburban/building-type-m.glb",
    rotationY: -0.22,
    roof: "garden",
  },
  {
    id: "south-service-hangar",
    position: [32, 0, 66],
    size: [17, 8, 12],
    color: "#3b5563",
    accent: "#fef3c7",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-a.glb",
    rotationY: -0.08,
    roof: "flat",
  },
  {
    id: "west-service-hangar",
    position: [-32, 0, 67],
    size: [17, 8, 12],
    color: "#3b5f5f",
    accent: "#d1fae5",
    modelPath: "/models/kenney-commercial/low-detail-building-wide-b.glb",
    rotationY: 0.08,
    roof: "flat",
  },
];

export const WORLD_PROPS: WorldPropDefinition[] = [
  { id: "runway-pad", kind: "platform", position: [0, 0, 88], size: [34, 0.42, 18], color: "#263747", accent: "#fef3c7", collider: true },
  { id: "runway-hangar-left", kind: "hangar", position: [-26, 0, 87], size: [14, 7, 14], color: "#34495e", accent: "#bfdbfe", rotationY: 0.18, collider: true },
  { id: "runway-hangar-right", kind: "hangar", position: [26, 0, 87], size: [14, 7, 14], color: "#3c5363", accent: "#bfdbfe", rotationY: -0.18, collider: true },
  { id: "dock-container-a", kind: "cargo", position: [-61, 0, 42], size: [7.5, 2.5, 3.2], color: "#0f766e", accent: "#99f6e4", rotationY: 0.2, collider: true },
  { id: "dock-container-b", kind: "cargo", position: [-76, 0, 58], size: [7.2, 2.5, 3.2], color: "#2563eb", accent: "#dbeafe", rotationY: -0.22, collider: true },
  { id: "dock-container-c", kind: "cargo", position: [-58, 0, 73], size: [8, 2.5, 3.2], color: "#14b8a6", accent: "#ccfbf1", rotationY: 0.1, collider: true },
  { id: "signal-antenna-base", kind: "antenna", position: [72, 0, -2], size: [4.5, 11.5, 4.5], color: "#164e63", accent: "#67e8f9", collider: true },
  { id: "latency-test-rig", kind: "terminal", position: [66, 0, -59], size: [6, 4.6, 4.6], color: "#6b3f66", accent: "#f9a8d4", rotationY: 0.28, collider: true },
  { id: "arcade-ticket-kiosk", kind: "terminal", position: [-11, 0, -42], size: [5.4, 4.2, 4.2], color: "#7e22ce", accent: "#f0abfc", rotationY: -0.15, collider: true },
  { id: "blink-projector-statue", kind: "terminal", position: [-44, 0, 18], size: [4.8, 4.6, 4.8], color: "#92400e", accent: "#fde68a", rotationY: 0.4, collider: true },
  { id: "command-relay-console", kind: "terminal", position: [13, 0, 64], size: [5.2, 4.2, 4.6], color: "#1d4ed8", accent: "#bfdbfe", rotationY: -0.35, collider: true },
  { id: "north-rock-a", kind: "rock", position: [-74, 0, -78], size: [8, 5.5, 7], color: "#577b7d", collider: true },
  { id: "north-rock-b", kind: "rock", position: [76, 0, -82], size: [9, 6.2, 8], color: "#577b7d", collider: true },
  { id: "east-rock-a", kind: "rock", position: [92, 0, 33], size: [7, 4.8, 8], color: "#52706e", collider: true },
  { id: "west-rock-a", kind: "rock", position: [-92, 0, 25], size: [7, 4.6, 8], color: "#52706e", collider: true },
];

export const STATIC_WORLD_COLLIDERS: StaticColliderConfig[] = [
  { id: "arrival-counter-left", position: [-6.6, 1.2, 25.8], size: [4.6, 2.4, 1.4], rotationY: -0.08 },
  { id: "arrival-counter-right", position: [6.6, 1.2, 25.8], size: [4.6, 2.4, 1.4], rotationY: 0.08 },
];

export const NPCS: NpcDefinition[] = [
  {
    id: "guide-io",
    name: "Io",
    role: "Skyport Guide",
    path: [
      [-5.5, 0, 20],
      [-14, 0, 27],
      [-7, 0, 38],
      [6, 0, 30],
    ],
    speed: 1.25,
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
      [29, 0, -7],
      [38, 0, -16],
      [45, 0, -1],
      [33, 0, 9],
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
      [-10, 0, -43],
      [9, 0, -45],
      [12, 0, -66],
      [-12, 0, -67],
    ],
    speed: 1.34,
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
      [-16, 0, 51],
      [16, 0, 51],
      [15, 0, 67],
      [-13, 0, 70],
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
      [-42, 0, 42],
      [-63, 0, 45],
      [-64, 0, 63],
      [-43, 0, 67],
    ],
    speed: 1.08,
    waitRange: [1.8, 3.6],
    palette: {
      Purple: "#10b981",
      LightBlue: "#a7f3d0",
      White: "#ecfdf5",
      Skin: "#e6b17e",
      Hair: "#064e3b",
    },
  },
  {
    id: "runner-vee",
    name: "Vee",
    role: "Airside Runner",
    path: [
      [21, 0, 72],
      [34, 0, 78],
      [19, 0, 88],
      [4, 0, 76],
    ],
    speed: 1.38,
    waitRange: [1.4, 2.8],
    palette: {
      Purple: "#0f766e",
      LightBlue: "#99f6e4",
      White: "#f8fafc",
      Skin: "#d49d73",
      Hair: "#0f172a",
    },
  },
];

export const WORLD_LAMPS: WorldLampDefinition[] = createLampPositions();
export const WORLD_TREES: WorldTreeDefinition[] = createTreePositions();

function createLampPositions(): WorldLampDefinition[] {
  const lamps: WorldLampDefinition[] = [];
  const segments: [Vec3Tuple, Vec3Tuple, number][] = [
    [[0, 0, 10], [-52, 0, 8], 8],
    [[0, 0, 10], [0, 0, -58], 8],
    [[0, 0, 10], [52, 0, -6], 8],
    [[0, 0, 10], [-52, 0, 54], 8],
    [[0, 0, 10], [0, 0, 58], 7],
    [[0, 0, 10], [48, 0, -52], 8],
  ];

  for (const [from, to, count] of segments) {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const length = Math.max(1, Math.sqrt(dx * dx + dz * dz));
    const normalX = -dz / length;
    const normalZ = dx / length;
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      const x = from[0] + dx * t;
      const z = from[2] + dz * t;
      const side = i % 2 === 0 ? 1 : -1;
      const lampX = x + normalX * side * 6.6;
      const lampZ = z + normalZ * side * 6.6;
      if (Math.abs(lampX) < 8 && lampZ > 24 && lampZ < 48) {
        continue;
      }

      lamps.push({
        id: `path-lamp-${lamps.length}`,
        position: [lampX, 0, lampZ],
        height: 3.35,
        color: i % 3 === 0 ? "#fde68a" : "#bfdbfe",
      });
    }
  }

  return lamps;
}

function createTreePositions(): WorldTreeDefinition[] {
  const trees: WorldTreeDefinition[] = [];
  const occupied = [
    [-52, 8, 17],
    [0, -58, 18],
    [52, -6, 17],
    [-52, 54, 18],
    [0, 58, 17],
    [48, -52, 18],
    [0, 10, 28],
  ] as const;

  for (let i = 0; i < 120; i += 1) {
    const angle = seededConfigNoise(i) * Math.PI * 2;
    const radius = 48 + seededConfigNoise(i + 4) * 43;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const blocked = occupied.some(([cx, cz, r]) => {
      const dx = cx - x;
      const dz = cz - z;
      return Math.sqrt(dx * dx + dz * dz) < r;
    });
    const tooNearMainLane = Math.abs(x) < 5.5 && z > -62 && z < 66;
    if (blocked || tooNearMainLane) {
      continue;
    }

    const variantSeed = seededConfigNoise(i + 33);
    trees.push({
      id: `ring-tree-${i}`,
      position: [x, 0, z],
      scale: 0.86 + seededConfigNoise(i + 11) * 0.9,
      variant: variantSeed > 0.72 ? "palm" : variantSeed > 0.42 ? "broadleaf" : "pine",
      collider: i % 5 === 0,
    });
  }

  const avenueTrees: Omit<WorldTreeDefinition, "id">[] = [
    { position: [-20, 0, 34], scale: 1.05, variant: "broadleaf" },
    { position: [20, 0, 34], scale: 1.05, variant: "broadleaf" },
    { position: [-24, 0, 46], scale: 1.15, variant: "broadleaf", collider: true },
    { position: [24, 0, 46], scale: 1.15, variant: "broadleaf", collider: true },
    { position: [-33, 0, -22], scale: 1.05, variant: "pine", collider: true },
    { position: [33, 0, -26], scale: 1.05, variant: "pine", collider: true },
    { position: [-75, 0, 19], scale: 1.18, variant: "broadleaf", collider: true },
    { position: [78, 0, 22], scale: 1.18, variant: "broadleaf", collider: true },
  ];

  avenueTrees.forEach((tree, index) => {
    trees.push({
      id: `avenue-tree-${index}`,
      ...tree,
    });
  });

  return trees;
}

function seededConfigNoise(index: number) {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
