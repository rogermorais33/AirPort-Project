"use client";

import { Float, Html, useAnimations, useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import { applyToonLook, computeObjectFit, recolorNamedMaterials } from "@/components/world/model-utils";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import type { WorldDistrict } from "@/lib/world-data";
import { cn } from "@/lib/utils";

interface SkyportGltfEnvironmentProps {
  gradientTexture: THREE.DataTexture;
  openDistrictId: string | null;
  districts: WorldDistrict[];
  onSelectDistrict: (districtId: string) => void;
}

interface SceneModelSpec {
  id: string;
  path: string;
  footprint: [number, number, number];
  position: [number, number, number];
  rotationY?: number;
  tint?: string;
  accent?: string;
  emissiveIntensity?: number;
  swayAmp?: number;
  swaySpeed?: number;
  swayPhase?: number;
}

interface SurfaceSpec {
  id: string;
  size: [number, number];
  position: [number, number, number];
  color: string;
  opacity?: number;
  rotationY?: number;
}

const SUPPORT_MODEL_PATHS = [
  "/models/kenney-commercial/building-a.glb",
  "/models/kenney-commercial/building-h.glb",
  "/models/kenney-suburban/building-type-a.glb",
  "/models/kenney-suburban/building-type-r.glb",
] as const;

const VENUE_AWNING_PATH = "/models/kenney-commercial/detail-awning-wide.glb";
const NPC_MODEL_PATH = "/models/avatar.glb";

const SKYLINE_BAND: SceneModelSpec[] = [
  {
    id: "skyline-nw-a",
    path: "/models/kenney-commercial/building-skyscraper-d.glb",
    footprint: [16, 44, 16],
    position: [-72, 0, -72],
    rotationY: Math.PI * 0.08,
    tint: "#e8eef7",
    accent: "#7dd3fc",
  },
  {
    id: "skyline-nw-b",
    path: "/models/kenney-commercial/building-skyscraper-b.glb",
    footprint: [16, 42, 16],
    position: [-56, 0, -78],
    rotationY: -Math.PI * 0.04,
    tint: "#e8eef7",
    accent: "#7dd3fc",
  },
  {
    id: "skyline-ne-a",
    path: "/models/kenney-commercial/building-skyscraper-b.glb",
    footprint: [16, 44, 16],
    position: [72, 0, -72],
    rotationY: -Math.PI * 0.08,
    tint: "#e8eef7",
    accent: "#bae6fd",
  },
  {
    id: "skyline-ne-b",
    path: "/models/kenney-commercial/building-skyscraper-d.glb",
    footprint: [16, 40, 16],
    position: [56, 0, -78],
    rotationY: Math.PI * 0.06,
    tint: "#e8eef7",
    accent: "#bae6fd",
  },
  {
    id: "skyline-sw-a",
    path: "/models/kenney-commercial/building-skyscraper-d.glb",
    footprint: [16, 40, 16],
    position: [-72, 0, 72],
    rotationY: Math.PI * 0.05,
    tint: "#e8eef7",
    accent: "#86efac",
  },
  {
    id: "skyline-sw-b",
    path: "/models/kenney-commercial/building-skyscraper-b.glb",
    footprint: [16, 38, 16],
    position: [-56, 0, 78],
    rotationY: -Math.PI * 0.05,
    tint: "#e8eef7",
    accent: "#86efac",
  },
  {
    id: "skyline-se-a",
    path: "/models/kenney-commercial/building-skyscraper-b.glb",
    footprint: [16, 40, 16],
    position: [72, 0, 72],
    rotationY: -Math.PI * 0.05,
    tint: "#e8eef7",
    accent: "#c4b5fd",
  },
  {
    id: "skyline-se-b",
    path: "/models/kenney-commercial/building-skyscraper-d.glb",
    footprint: [16, 38, 16],
    position: [56, 0, 78],
    rotationY: Math.PI * 0.05,
    tint: "#e8eef7",
    accent: "#c4b5fd",
  },
  {
    id: "skyline-west",
    path: "/models/kenney-commercial/low-detail-building-wide-a.glb",
    footprint: [20, 24, 12],
    position: [-84, 0, 0],
    rotationY: Math.PI * 0.1,
    tint: "#e8eef7",
    accent: "#93c5fd",
  },
  {
    id: "skyline-east",
    path: "/models/kenney-commercial/low-detail-building-wide-b.glb",
    footprint: [20, 24, 12],
    position: [84, 0, 0],
    rotationY: -Math.PI * 0.1,
    tint: "#e8eef7",
    accent: "#93c5fd",
  },
] as const;

const NEIGHBORHOOD_BLOCKS: SceneModelSpec[] = [
  {
    id: "north-west-houses-a",
    path: "/models/kenney/building-sample-house-a.glb",
    footprint: [10, 10, 10],
    position: [-48, 0, -48],
    rotationY: Math.PI,
    tint: "#f8fafc",
    accent: "#fde68a",
  },
  {
    id: "north-west-houses-b",
    path: "/models/kenney/building-sample-house-b.glb",
    footprint: [10, 10, 10],
    position: [-36, 0, -48],
    rotationY: Math.PI,
    tint: "#f8fafc",
    accent: "#fde68a",
  },
  {
    id: "north-east-houses-a",
    path: "/models/kenney/building-sample-house-c.glb",
    footprint: [10, 10, 10],
    position: [36, 0, -48],
    rotationY: Math.PI,
    tint: "#f8fafc",
    accent: "#bae6fd",
  },
  {
    id: "north-east-houses-b",
    path: "/models/kenney/building-sample-house-a.glb",
    footprint: [10, 10, 10],
    position: [48, 0, -48],
    rotationY: Math.PI,
    tint: "#f8fafc",
    accent: "#bae6fd",
  },
  {
    id: "south-west-houses-a",
    path: "/models/kenney/building-sample-house-b.glb",
    footprint: [10, 10, 10],
    position: [-48, 0, 48],
    rotationY: 0,
    tint: "#f8fafc",
    accent: "#bbf7d0",
  },
  {
    id: "south-west-houses-b",
    path: "/models/kenney/building-sample-house-c.glb",
    footprint: [10, 10, 10],
    position: [-36, 0, 48],
    rotationY: 0,
    tint: "#f8fafc",
    accent: "#bbf7d0",
  },
  {
    id: "south-east-houses-a",
    path: "/models/kenney/building-sample-house-a.glb",
    footprint: [10, 10, 10],
    position: [36, 0, 48],
    rotationY: 0,
    tint: "#f8fafc",
    accent: "#fbcfe8",
  },
  {
    id: "south-east-houses-b",
    path: "/models/kenney/building-sample-house-b.glb",
    footprint: [10, 10, 10],
    position: [48, 0, 48],
    rotationY: 0,
    tint: "#f8fafc",
    accent: "#fbcfe8",
  },
  {
    id: "west-mid-block",
    path: "/models/kenney-suburban/building-type-h.glb",
    footprint: [10, 10, 10],
    position: [-56, 0, 10],
    rotationY: Math.PI / 2,
    tint: "#f8fafc",
    accent: "#a7f3d0",
  },
  {
    id: "west-mid-block-a",
    path: "/models/kenney-suburban/building-type-a.glb",
    footprint: [10, 10, 10],
    position: [-56, 0, -10],
    rotationY: Math.PI / 2,
    tint: "#f8fafc",
    accent: "#a7f3d0",
  },
  {
    id: "east-mid-block",
    path: "/models/kenney-suburban/building-type-r.glb",
    footprint: [10, 10, 10],
    position: [56, 0, -10],
    rotationY: -Math.PI / 2,
    tint: "#f8fafc",
    accent: "#bfdbfe",
  },
  {
    id: "east-mid-block-m",
    path: "/models/kenney-suburban/building-type-m.glb",
    footprint: [10, 10, 10],
    position: [56, 0, 10],
    rotationY: -Math.PI / 2,
    tint: "#f8fafc",
    accent: "#bfdbfe",
  },
] as const;

const TREE_BAND: SceneModelSpec[] = [
  ...createTreeLine("tree-north", -60, -20, 60, -20),
  ...createTreeLine("tree-south", -60, 20, 60, 20),
  ...createTreeLine("tree-west", -20, -60, -20, 60),
  ...createTreeLine("tree-east", 20, -60, 20, 60),
  {
    id: "tree-square-1",
    path: "/models/kenney-suburban/tree-large.glb",
    footprint: [5, 9, 5],
    position: [-12, 0, -12],
    tint: "#eefaf0",
    accent: "#4ade80",
    swayAmp: 0.04,
    swaySpeed: 0.9,
    swayPhase: 0.2,
  },
  {
    id: "tree-square-2",
    path: "/models/kenney-suburban/tree-large.glb",
    footprint: [5, 9, 5],
    position: [12, 0, -12],
    tint: "#eefaf0",
    accent: "#4ade80",
    swayAmp: 0.04,
    swaySpeed: 0.84,
    swayPhase: 1.1,
  },
  {
    id: "tree-square-3",
    path: "/models/kenney-suburban/tree-large.glb",
    footprint: [5, 9, 5],
    position: [-12, 0, 12],
    tint: "#eefaf0",
    accent: "#4ade80",
    swayAmp: 0.035,
    swaySpeed: 0.96,
    swayPhase: 2.1,
  },
  {
    id: "tree-square-4",
    path: "/models/kenney-suburban/tree-large.glb",
    footprint: [5, 9, 5],
    position: [12, 0, 12],
    tint: "#eefaf0",
    accent: "#4ade80",
    swayAmp: 0.035,
    swaySpeed: 0.88,
    swayPhase: 2.8,
  },
] as const;

const STREET_PROPS: SceneModelSpec[] = [
  {
    id: "lamp-nw",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [-10, 0, -34],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-ne",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [10, 0, -34],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-sw",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [-10, 0, 34],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-se",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [10, 0, 34],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-west-north",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [-34, 0, -10],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-west-south",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [-34, 0, 10],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-east-north",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [34, 0, -10],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "lamp-east-south",
    path: "/models/kenney-roads/light-square.glb",
    footprint: [1.8, 5, 1.8],
    position: [34, 0, 10],
    tint: "#eef2f7",
    accent: "#fde68a",
    emissiveIntensity: 0.14,
  },
  {
    id: "entry-sign-north",
    path: "/models/kenney-roads/sign-highway-wide.glb",
    footprint: [6, 4.2, 1.2],
    position: [0, 0, -46],
    rotationY: Math.PI,
    tint: "#eff6ff",
    accent: "#60a5fa",
    emissiveIntensity: 0.07,
  },
  {
    id: "entry-sign-south",
    path: "/models/kenney-roads/sign-highway-wide.glb",
    footprint: [6, 4.2, 1.2],
    position: [0, 0, 46],
    tint: "#eff6ff",
    accent: "#34d399",
    emissiveIntensity: 0.07,
  },
  {
    id: "parked-car-west",
    path: "/models/kenney-cars/sedan.glb",
    footprint: [5, 2.2, 8.2],
    position: [-24, 0, -36],
    rotationY: Math.PI / 2,
    tint: "#f8fafc",
    accent: "#60a5fa",
  },
  {
    id: "parked-car-east",
    path: "/models/kenney-cars/taxi.glb",
    footprint: [5, 2.2, 8.2],
    position: [24, 0, -36],
    rotationY: -Math.PI / 2,
    tint: "#fef3c7",
    accent: "#f59e0b",
  },
  {
    id: "parked-car-south-west",
    path: "/models/kenney-cars/van.glb",
    footprint: [5.4, 2.4, 8.6],
    position: [-24, 0, 36],
    rotationY: Math.PI / 2,
    tint: "#f8fafc",
    accent: "#34d399",
  },
  {
    id: "parked-car-south-east",
    path: "/models/kenney-cars/police.glb",
    footprint: [5, 2.2, 8.2],
    position: [24, 0, 36],
    rotationY: -Math.PI / 2,
    tint: "#eff6ff",
    accent: "#38bdf8",
  },
  {
    id: "planter-west",
    path: "/models/kenney-suburban/planter.glb",
    footprint: [2.8, 1.8, 2.8],
    position: [-5.5, 0, 5],
    tint: "#f8fafc",
    accent: "#67e8f9",
  },
  {
    id: "planter-east",
    path: "/models/kenney-suburban/planter.glb",
    footprint: [2.8, 1.8, 2.8],
    position: [5.5, 0, -5],
    tint: "#f8fafc",
    accent: "#67e8f9",
  },
  {
    id: "fence-park-north",
    path: "/models/kenney-suburban/fence-low.glb",
    footprint: [8, 1.2, 0.8],
    position: [0, 0, -22],
    tint: "#eff6ff",
    accent: "#86efac",
  },
  {
    id: "fence-park-south",
    path: "/models/kenney-suburban/fence-low.glb",
    footprint: [8, 1.2, 0.8],
    position: [0, 0, 22],
    tint: "#eff6ff",
    accent: "#86efac",
  },
] as const;

const TRAFFIC_LOOP_MAIN: [number, number, number][] = [
  [-28, 0, -28],
  [28, 0, -28],
  [28, 0, 28],
  [-28, 0, 28],
];

const TRAFFIC_LOOP_ALT: [number, number, number][] = [
  [-40, 0, -16],
  [40, 0, -16],
  [40, 0, 16],
  [-40, 0, 16],
];

const TRAFFIC_CARS = [
  {
    id: "traffic-sedan",
    path: "/models/kenney-cars/sedan.glb",
    tint: "#eff6ff",
    accent: "#60a5fa",
    speed: 5.2,
    offset: 0,
    route: TRAFFIC_LOOP_MAIN,
    footprint: [4.8, 2.1, 8] as [number, number, number],
  },
  {
    id: "traffic-taxi",
    path: "/models/kenney-cars/taxi.glb",
    tint: "#fef3c7",
    accent: "#f59e0b",
    speed: 4.8,
    offset: 31,
    route: TRAFFIC_LOOP_MAIN,
    footprint: [4.8, 2.1, 8] as [number, number, number],
  },
  {
    id: "traffic-van",
    path: "/models/kenney-cars/van.glb",
    tint: "#f8fafc",
    accent: "#34d399",
    speed: 4.2,
    offset: 16,
    route: TRAFFIC_LOOP_ALT,
    footprint: [5.4, 2.4, 8.6] as [number, number, number],
  },
] as const;

const RUNWAY_DASHES = Array.from({ length: 13 }).map((_, index) => -72 + index * 12);
const RUNWAY_LIGHTS = Array.from({ length: 18 }).map((_, index) => -82 + index * 9.6);

const HORIZON_MOUNTAINS = [
  { id: "ridge-n-1", position: [-142, 0, -158] as [number, number, number], radius: 34, height: 32, color: "#6f8794", rotationY: 0.2 },
  { id: "ridge-n-2", position: [-94, 0, -166] as [number, number, number], radius: 42, height: 42, color: "#78919a", rotationY: -0.16 },
  { id: "ridge-n-3", position: [-42, 0, -162] as [number, number, number], radius: 36, height: 35, color: "#617f8e", rotationY: 0.34 },
  { id: "ridge-n-4", position: [8, 0, -170] as [number, number, number], radius: 48, height: 45, color: "#739099", rotationY: -0.08 },
  { id: "ridge-n-5", position: [68, 0, -164] as [number, number, number], radius: 40, height: 38, color: "#658493", rotationY: 0.24 },
  { id: "ridge-n-6", position: [126, 0, -158] as [number, number, number], radius: 34, height: 31, color: "#78919a", rotationY: -0.28 },
  { id: "ridge-w-1", position: [-160, 0, -80] as [number, number, number], radius: 34, height: 28, color: "#617f8e", rotationY: 0.58 },
  { id: "ridge-e-1", position: [160, 0, -72] as [number, number, number], radius: 32, height: 29, color: "#6f8794", rotationY: -0.52 },
  { id: "ridge-s-1", position: [-108, 0, 156] as [number, number, number], radius: 34, height: 25, color: "#5f8178", rotationY: 0.14 },
  { id: "ridge-s-2", position: [98, 0, 160] as [number, number, number], radius: 38, height: 27, color: "#668a7c", rotationY: -0.22 },
] as const;

const DISTANT_TOWERS = [
  { id: "distant-a", position: [-112, 10, -126] as [number, number, number], size: [8, 20, 8] as [number, number, number], color: "#4f6f86" },
  { id: "distant-b", position: [-96, 15, -132] as [number, number, number], size: [10, 30, 10] as [number, number, number], color: "#5d7790" },
  { id: "distant-c", position: [-78, 12, -128] as [number, number, number], size: [9, 24, 9] as [number, number, number], color: "#55758a" },
  { id: "distant-d", position: [78, 14, -130] as [number, number, number], size: [10, 28, 10] as [number, number, number], color: "#55758a" },
  { id: "distant-e", position: [98, 11, -126] as [number, number, number], size: [8, 22, 8] as [number, number, number], color: "#4f6f86" },
  { id: "distant-f", position: [116, 17, -134] as [number, number, number], size: [11, 34, 11] as [number, number, number], color: "#5d7790" },
] as const;

const PRELOAD_PATHS = [
  ...new Set<string>([
    ...SKYLINE_BAND.map((item) => item.path),
    ...NEIGHBORHOOD_BLOCKS.map((item) => item.path),
    ...TREE_BAND.map((item) => item.path),
    ...STREET_PROPS.map((item) => item.path),
    ...SUPPORT_MODEL_PATHS,
    VENUE_AWNING_PATH,
    NPC_MODEL_PATH,
  ]),
];

for (const path of PRELOAD_PATHS) {
  useGLTF.preload(path);
}

export function SkyportGltfEnvironment({
  gradientTexture,
  openDistrictId,
  districts,
  onSelectDistrict,
}: SkyportGltfEnvironmentProps) {
  return (
    <>
      <TownSurface gradientTexture={gradientTexture} districts={districts} />
      <OutskirtsScenery gradientTexture={gradientTexture} />
      <CentralPlaza gradientTexture={gradientTexture} />
      <DistrictGuideLines districts={districts} />
      <DistrictGlowRings districts={districts} />

      <Suspense fallback={null}>
        <SceneryBand models={SKYLINE_BAND} gradientTexture={gradientTexture} defaultEmissive={0.03} />
        <SceneryBand models={NEIGHBORHOOD_BLOCKS} gradientTexture={gradientTexture} defaultEmissive={0.03} />
        <SceneryBand models={TREE_BAND} gradientTexture={gradientTexture} defaultEmissive={0.04} />
        <SceneryBand models={STREET_PROPS} gradientTexture={gradientTexture} defaultEmissive={0.04} />
        <TownNpcs gradientTexture={gradientTexture} />
        <TrafficCars gradientTexture={gradientTexture} />
      </Suspense>

      {districts.map((district) => (
        <Suspense key={district.id} fallback={null}>
          <DistrictVenue
            district={district}
            gradientTexture={gradientTexture}
            open={district.id === openDistrictId}
            onSelectDistrict={onSelectDistrict}
          />
        </Suspense>
      ))}
    </>
  );
}

function OutskirtsScenery({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <DistantTerrain gradientTexture={gradientTexture} />
      <AirportHorizon gradientTexture={gradientTexture} />
      <CoastalHarbor gradientTexture={gradientTexture} />
      <ElevatedTransit gradientTexture={gradientTexture} />
    </group>
  );
}

function TownSurface({
  gradientTexture,
  districts,
}: {
  gradientTexture: THREE.DataTexture;
  districts: WorldDistrict[];
}) {
  const roadSurfaces = useMemo<SurfaceSpec[]>(
    () => [
      { id: "road-main-ew", size: [172, 14], position: [0, 0.035, 0], color: "#4a5563" },
      { id: "road-main-ns", size: [14, 172], position: [0, 0.035, 0], color: "#4a5563" },
      { id: "road-ring-n", size: [132, 10], position: [0, 0.035, -34], color: "#4a5563" },
      { id: "road-ring-s", size: [132, 10], position: [0, 0.035, 34], color: "#4a5563" },
      { id: "road-ring-w", size: [10, 132], position: [-34, 0.035, 0], color: "#4a5563" },
      { id: "road-ring-e", size: [10, 132], position: [34, 0.035, 0], color: "#4a5563" },
      { id: "district-link-sw", size: [8, 24], position: [-24, 0.035, 22], color: "#4a5563", rotationY: Math.PI * 0.14 },
      { id: "district-link-ne", size: [8, 24], position: [24, 0.035, -22], color: "#4a5563", rotationY: Math.PI * 0.14 },
    ],
    [],
  );

  const sidewalks = useMemo<SurfaceSpec[]>(
    () => [
      { id: "walk-main-n", size: [172, 3.4], position: [0, 0.045, -9], color: "#dce3ea" },
      { id: "walk-main-s", size: [172, 3.4], position: [0, 0.045, 9], color: "#dce3ea" },
      { id: "walk-main-w", size: [3.4, 172], position: [-9, 0.045, 0], color: "#dce3ea" },
      { id: "walk-main-e", size: [3.4, 172], position: [9, 0.045, 0], color: "#dce3ea" },
      { id: "walk-ring-n-outer", size: [132, 3], position: [0, 0.045, -39], color: "#dce3ea" },
      { id: "walk-ring-n-inner", size: [132, 3], position: [0, 0.045, -29], color: "#dce3ea" },
      { id: "walk-ring-s-outer", size: [132, 3], position: [0, 0.045, 39], color: "#dce3ea" },
      { id: "walk-ring-s-inner", size: [132, 3], position: [0, 0.045, 29], color: "#dce3ea" },
      { id: "walk-ring-w-outer", size: [3, 132], position: [-39, 0.045, 0], color: "#dce3ea" },
      { id: "walk-ring-w-inner", size: [3, 132], position: [-29, 0.045, 0], color: "#dce3ea" },
      { id: "walk-ring-e-outer", size: [3, 132], position: [39, 0.045, 0], color: "#dce3ea" },
      { id: "walk-ring-e-inner", size: [3, 132], position: [29, 0.045, 0], color: "#dce3ea" },
    ],
    [],
  );

  const roadMarkings = useMemo<SurfaceSpec[]>(
    () => [
      { id: "line-main-ew", size: [172, 0.5], position: [0, 0.055, 0], color: "#f8fafc", opacity: 0.24 },
      { id: "line-main-ns", size: [0.5, 172], position: [0, 0.055, 0], color: "#f8fafc", opacity: 0.24 },
      { id: "line-ring-n", size: [132, 0.4], position: [0, 0.055, -34], color: "#f8fafc", opacity: 0.2 },
      { id: "line-ring-s", size: [132, 0.4], position: [0, 0.055, 34], color: "#f8fafc", opacity: 0.2 },
      { id: "line-ring-w", size: [0.4, 132], position: [-34, 0.055, 0], color: "#f8fafc", opacity: 0.2 },
      { id: "line-ring-e", size: [0.4, 132], position: [34, 0.055, 0], color: "#f8fafc", opacity: 0.2 },
      { id: "cross-north", size: [7.4, 1.6], position: [0, 0.06, -9], color: "#f8fafc", opacity: 0.18 },
      { id: "cross-south", size: [7.4, 1.6], position: [0, 0.06, 9], color: "#f8fafc", opacity: 0.18 },
      { id: "cross-west", size: [1.6, 7.4], position: [-9, 0.06, 0], color: "#f8fafc", opacity: 0.18 },
      { id: "cross-east", size: [1.6, 7.4], position: [9, 0.06, 0], color: "#f8fafc", opacity: 0.18 },
    ],
    [],
  );

  const lawns = useMemo<SurfaceSpec[]>(
    () => [
      { id: "lawn-nw", size: [22, 22], position: [-18, 0.025, -18], color: "#4a6a4f" },
      { id: "lawn-ne", size: [22, 22], position: [18, 0.025, -18], color: "#4a6a4f" },
      { id: "lawn-sw", size: [22, 22], position: [-18, 0.025, 18], color: "#4a6a4f" },
      { id: "lawn-se", size: [22, 22], position: [18, 0.025, 18], color: "#4a6a4f" },
      { id: "lawn-west", size: [20, 34], position: [-50, 0.025, 0], color: "#4a6a4f" },
      { id: "lawn-east", size: [20, 34], position: [50, 0.025, 0], color: "#4a6a4f" },
      { id: "lawn-north", size: [34, 20], position: [0, 0.025, -50], color: "#4a6a4f" },
      { id: "lawn-south", size: [34, 20], position: [0, 0.025, 50], color: "#4a6a4f" },
    ],
    [],
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshToonMaterial color="#2f4b36" gradientMap={gradientTexture} />
      </mesh>

      {lawns.map((surface) => (
        <SurfacePlane key={surface.id} surface={surface} gradientTexture={gradientTexture} />
      ))}

      {roadSurfaces.map((surface) => (
        <SurfacePlane key={surface.id} surface={surface} gradientTexture={gradientTexture} />
      ))}

      {sidewalks.map((surface) => (
        <SurfacePlane key={surface.id} surface={surface} gradientTexture={gradientTexture} />
      ))}

      {roadMarkings.map((surface) => (
        <mesh key={surface.id} rotation-x={-Math.PI / 2} rotation-z={surface.rotationY ?? 0} position={surface.position}>
          <planeGeometry args={surface.size} />
          <meshBasicMaterial color={surface.color} transparent opacity={surface.opacity ?? 0.2} />
        </mesh>
      ))}

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} receiveShadow>
        <circleGeometry args={[18, 72]} />
        <meshToonMaterial color="#d4dde7" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[18.8, 21, 72]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      {districts.map((district) => {
        const districtYaw = Math.atan2(-district.position[0], -district.position[2]);
        return (
          <group key={`${district.id}-surface`} position={[district.position[0], 0, district.position[2]]} rotation={[0, districtYaw, 0]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, -1]} receiveShadow>
              <planeGeometry args={[22, 18]} />
              <meshToonMaterial color="#9aa7b8" gradientMap={gradientTexture} />
            </mesh>

            <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 4]} receiveShadow>
              <planeGeometry args={[8.8, 7]} />
              <meshToonMaterial color="#e2e8f0" gradientMap={gradientTexture} />
            </mesh>

            <mesh rotation-x={-Math.PI / 2} position={[0, 0.09, 8]} receiveShadow>
              <planeGeometry args={[5.2, 8.4]} />
              <meshToonMaterial color="#d7e0ea" gradientMap={gradientTexture} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SurfacePlane({
  surface,
  gradientTexture,
}: {
  surface: SurfaceSpec;
  gradientTexture: THREE.DataTexture;
}) {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      rotation-z={surface.rotationY ?? 0}
      position={surface.position}
      receiveShadow
    >
      <planeGeometry args={surface.size} />
      <meshToonMaterial color={surface.color} gradientMap={gradientTexture} />
    </mesh>
  );
}

function DistantTerrain({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -136]}>
        <planeGeometry args={[360, 82]} />
        <meshToonMaterial color="#405f55" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 138]}>
        <planeGeometry args={[380, 104]} />
        <meshBasicMaterial color="#3f9fb4" transparent opacity={0.78} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 96]}>
        <planeGeometry args={[320, 20]} />
        <meshToonMaterial color="#d4c7a4" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 7, -147]}>
        <planeGeometry args={[360, 32]} />
        <meshBasicMaterial color="#cfe0e8" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {HORIZON_MOUNTAINS.map((mountain) => (
        <mesh
          key={mountain.id}
          position={[mountain.position[0], mountain.height / 2 - 1.4, mountain.position[2]]}
          rotation-y={mountain.rotationY}
        >
          <coneGeometry args={[mountain.radius, mountain.height, 4]} />
          <meshToonMaterial color={mountain.color} gradientMap={gradientTexture} transparent opacity={0.82} />
        </mesh>
      ))}

      {DISTANT_TOWERS.map((tower) => (
        <mesh key={tower.id} position={tower.position}>
          <boxGeometry args={tower.size} />
          <meshBasicMaterial color={tower.color} transparent opacity={0.46} />
        </mesh>
      ))}
    </group>
  );
}

function AirportHorizon({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group position={[0, 0, -24]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, -109]} receiveShadow>
        <planeGeometry args={[174, 30]} />
        <meshToonMaterial color="#55645f" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.082, -110]} receiveShadow>
        <planeGeometry args={[158, 18]} />
        <meshToonMaterial color="#2d3744" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.088, -82]} receiveShadow>
        <planeGeometry args={[118, 8]} />
        <meshToonMaterial color="#42505d" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI * 0.18} position={[44, 0.09, -93]} receiveShadow>
        <planeGeometry args={[52, 7]} />
        <meshToonMaterial color="#42505d" gradientMap={gradientTexture} />
      </mesh>

      {RUNWAY_DASHES.map((x) => (
        <mesh key={`runway-dash-${x}`} rotation-x={-Math.PI / 2} position={[x, 0.105, -110]}>
          <planeGeometry args={[5.2, 0.48]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.58} />
        </mesh>
      ))}

      {RUNWAY_LIGHTS.map((x) => (
        <group key={`runway-light-${x}`}>
          <mesh position={[x, 0.24, -99.2]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color="#a7f3d0" transparent opacity={0.92} />
          </mesh>
          <mesh position={[x, 0.24, -120.8]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color="#bfdbfe" transparent opacity={0.92} />
          </mesh>
        </group>
      ))}

      <TerminalBuilding gradientTexture={gradientTexture} />
      <ControlTower gradientTexture={gradientTexture} />
      <AirportShuttle gradientTexture={gradientTexture} />
    </group>
  );
}

function TerminalBuilding({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group position={[-44, 0, -78]}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[34, 6.4, 9]} />
        <meshToonMaterial color="#d8e4ec" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 6.8, -0.8]} castShadow receiveShadow>
        <boxGeometry args={[38, 1.2, 10.4]} />
        <meshToonMaterial color="#9caeb9" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 3.5, 4.65]}>
        <boxGeometry args={[30, 3.4, 0.18]} />
        <meshBasicMaterial color="#24516a" transparent opacity={0.72} />
      </mesh>
      <mesh position={[18.5, 2, 1.8]} castShadow receiveShadow>
        <boxGeometry args={[9, 4, 5]} />
        <meshToonMaterial color="#eff6ff" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[18.5, 2.4, 4.5]}>
        <boxGeometry args={[6.8, 1.6, 0.16]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.62} />
      </mesh>
    </group>
  );
}

function ControlTower({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group position={[47, 0, -78]}>
      <mesh position={[0, 5.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.25, 1.75, 11.2, 10]} />
        <meshToonMaterial color="#cbd5e1" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 11.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.3, 2.8, 2.4, 8]} />
        <meshToonMaterial color="#e2e8f0" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 11.9, 0]}>
        <cylinderGeometry args={[3.42, 3.42, 1, 8, 1, true]} />
        <meshBasicMaterial color="#0f2b3a" transparent opacity={0.56} />
      </mesh>
      <mesh position={[0, 13.35, 0]} castShadow>
        <coneGeometry args={[3.25, 1.35, 8]} />
        <meshToonMaterial color="#7dd3fc" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 15.1, 0]}>
        <sphereGeometry args={[0.24, 14, 14]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function AirportShuttle({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const rootRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    if (!rootRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;
    rootRef.current.position.x = THREE.MathUtils.lerp(-32, 34, (Math.sin(t * 0.16) + 1) / 2);
    rootRef.current.rotation.z = Math.sin(t * 0.9) * 0.012;
  });

  return (
    <group ref={rootRef} position={[18, 1.05, -109.5]} rotation-y={Math.PI / 2}>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 8.8, 18]} />
        <meshToonMaterial color="#f8fafc" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.58, 0.3, 1.2, 18]} />
        <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, -0.12, 0]} rotation-z={Math.PI / 2}>
        <boxGeometry args={[0.16, 5.8, 3.2]} />
        <meshToonMaterial color="#bfdbfe" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[-2.6, -0.05, 0]} rotation-z={Math.PI / 2}>
        <boxGeometry args={[0.12, 2.8, 1.2]} />
        <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

function CoastalHarbor({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[-38, 0.08, 82]} receiveShadow>
        <planeGeometry args={[52, 8]} />
        <meshToonMaterial color="#d9cfb2" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[-36, 0.34, 98]} castShadow receiveShadow>
        <boxGeometry args={[42, 0.68, 5.4]} />
        <meshToonMaterial color="#8b6f4d" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[-56, 1.8, 97]} castShadow receiveShadow>
        <boxGeometry args={[7, 3.6, 5]} />
        <meshToonMaterial color="#e7eef5" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[-56, 3.9, 97]} castShadow>
        <coneGeometry args={[4.6, 2.2, 4]} />
        <meshToonMaterial color="#34d399" gradientMap={gradientTexture} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-18, 0.1, 118]}>
        <ringGeometry args={[10, 13, 48]} />
        <meshBasicMaterial color="#d1fae5" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ElevatedTransit({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const route = useMemo(
    () =>
      createRouteGeometry([
        [-56, 5.4, -56],
        [56, 5.4, -56],
        [56, 5.4, 56],
        [-56, 5.4, 56],
      ]),
    [],
  );

  return (
    <group>
      <mesh position={[0, 5.3, -56]} castShadow receiveShadow>
        <boxGeometry args={[116, 0.22, 0.36]} />
        <meshToonMaterial color="#a7b7c5" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 5.3, 56]} castShadow receiveShadow>
        <boxGeometry args={[116, 0.22, 0.36]} />
        <meshToonMaterial color="#a7b7c5" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[-56, 5.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.22, 116]} />
        <meshToonMaterial color="#a7b7c5" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[56, 5.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.22, 116]} />
        <meshToonMaterial color="#a7b7c5" gradientMap={gradientTexture} />
      </mesh>

      {[-56, -28, 0, 28, 56].map((x) => (
        <group key={`transit-pillar-${x}`}>
          <TransitPillar gradientTexture={gradientTexture} position={[x, 2.5, -56]} />
          <TransitPillar gradientTexture={gradientTexture} position={[x, 2.5, 56]} />
          {x !== -56 && x !== 56 ? null : (
            <>
              <TransitPillar gradientTexture={gradientTexture} position={[x, 2.5, -28]} />
              <TransitPillar gradientTexture={gradientTexture} position={[x, 2.5, 28]} />
            </>
          )}
        </group>
      ))}

      <TransitShuttle route={route} gradientTexture={gradientTexture} />
    </group>
  );
}

function TransitPillar({
  gradientTexture,
  position,
}: {
  gradientTexture: THREE.DataTexture;
  position: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[0.2, 0.32, 5, 8]} />
      <meshToonMaterial color="#cbd5e1" gradientMap={gradientTexture} />
    </mesh>
  );
}

function TransitShuttle({
  route,
  gradientTexture,
}: {
  route: ReturnType<typeof createRouteGeometry>;
  gradientTexture: THREE.DataTexture;
}) {
  const rootRef = useRef<THREE.Group | null>(null);
  const sampledPosition = useMemo(() => new THREE.Vector3(), []);
  const sampledDirection = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useFrame((state) => {
    if (!rootRef.current) {
      return;
    }
    sampleRoute(route, state.clock.elapsedTime * 8.5, sampledPosition, sampledDirection);
    rootRef.current.position.copy(sampledPosition);
    rootRef.current.rotation.y = Math.atan2(sampledDirection.x, sampledDirection.z);
  });

  return (
    <group ref={rootRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[5.8, 1.2, 1.3]} />
        <meshToonMaterial color="#e0f2fe" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 0.16, 0.68]}>
        <boxGeometry args={[4.4, 0.52, 0.08]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

function DistrictGuideLines({ districts }: { districts: WorldDistrict[] }) {
  return (
    <>
      {districts.map((district) => {
        const distance = Math.sqrt(district.position[0] * district.position[0] + district.position[2] * district.position[2]);
        const yaw = Math.atan2(district.position[0], district.position[2]);
        const length = Math.max(8, distance - 13);

        return (
          <group
            key={`${district.id}-guide`}
            position={[district.position[0] * 0.5, 0.115, district.position[2] * 0.5]}
            rotation-y={yaw}
          >
            <mesh rotation-x={-Math.PI / 2}>
              <planeGeometry args={[1.15, length]} />
              <meshBasicMaterial color={district.color} transparent opacity={0.14} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, length * 0.38]}>
              <ringGeometry args={[0.7, 0.92, 3]} />
              <meshBasicMaterial color={district.accent} transparent opacity={0.34} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function SceneryBand({
  models,
  gradientTexture,
  defaultEmissive,
}: {
  models: readonly SceneModelSpec[];
  gradientTexture: THREE.DataTexture;
  defaultEmissive: number;
}) {
  return (
    <group>
      {models.map((model) => (
        <SceneryModel
          key={model.id}
          path={model.path}
          gradientTexture={gradientTexture}
          tint={model.tint ?? "#edf4ff"}
          accent={model.accent ?? "#67e8f9"}
          footprint={model.footprint}
          position={model.position}
          rotationY={model.rotationY ?? 0}
          emissiveIntensity={model.emissiveIntensity ?? defaultEmissive}
          swayAmp={model.swayAmp ?? 0}
          swaySpeed={model.swaySpeed ?? 0}
          swayPhase={model.swayPhase ?? 0}
        />
      ))}
    </group>
  );
}

function DistrictVenue({
  district,
  gradientTexture,
  open,
  onSelectDistrict,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  open: boolean;
  onSelectDistrict: (districtId: string) => void;
}) {
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const focused = nearDistrictId === district.id;
  const districtYaw = Math.atan2(-district.position[0], -district.position[2]);
  const supportModels = useMemo(() => getSupportModelsForDistrict(district.id), [district.id]);

  return (
    <RigidBody type="fixed" colliders={false} position={district.position} rotation={[0, districtYaw, 0]}>
      <CuboidCollider
        args={[district.shellSize[0] / 2, district.shellSize[1] / 2, district.shellSize[2] / 2]}
        position={[0, district.shellSize[1] / 2, -1.2]}
      />
      <CuboidCollider args={[2.3, 2.8, 2.3]} position={[-5.8, 2.8, -1.8]} />
      <CuboidCollider args={[2.3, 2.8, 2.3]} position={[5.8, 2.8, -1.8]} />

      <SceneryModel
        path={district.landmarkModelPath}
        gradientTexture={gradientTexture}
        tint="#edf4ff"
        accent={district.accent}
        footprint={district.shellSize}
        position={[0, 0, -1.2]}
        rotationY={Math.PI}
        emissiveIntensity={open ? 0.1 : focused ? 0.07 : 0.04}
      />

      <SceneryModel
        path={supportModels[0]}
        gradientTexture={gradientTexture}
        tint="#f2f7ff"
        accent={district.accent}
        footprint={[4.8, 5.6, 4.8]}
        position={[-5.8, 0, -2.4]}
        rotationY={Math.PI * 0.82}
        emissiveIntensity={focused ? 0.05 : 0.02}
      />

      <SceneryModel
        path={supportModels[1]}
        gradientTexture={gradientTexture}
        tint="#f2f7ff"
        accent={district.accent}
        footprint={[4.8, 5.6, 4.8]}
        position={[5.8, 0, -2.4]}
        rotationY={Math.PI * 1.18}
        emissiveIntensity={focused ? 0.05 : 0.02}
      />

      <VenueEntrance
        district={district}
        gradientTexture={gradientTexture}
        focused={focused}
        open={open}
        onClick={() => onSelectDistrict(district.id)}
      />

      <VenueBeacon district={district} focused={focused} open={open} />

      {focused ? (
        <InteractionMarker
          position={[0, district.shellSize[1] + 1.8, district.shellSize[2] * 0.24]}
          color={district.color}
          accent={district.accent}
          label="enter venue"
        />
      ) : null}

      <Html position={[0, district.shellSize[1] + 1.1, district.shellSize[2] * 0.16]} center distanceFactor={14}>
        <button
          type="button"
          className={cn(
            "min-w-[182px] rounded-2xl border px-3 py-2 text-center backdrop-blur-md transition-all",
            focused
              ? "border-cyan-300/35 bg-slate-950/84 text-white shadow-[0_0_26px_rgba(34,211,238,0.2)]"
              : "border-white/10 bg-slate-950/62 text-white/74",
          )}
          onClick={() => onSelectDistrict(district.id)}
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">{district.signLabel}</p>
          <p className="mt-1 text-sm font-semibold">{district.title}</p>
          <p className="mt-1 text-xs text-white/52">{district.subtitle}</p>
        </button>
      </Html>
    </RigidBody>
  );
}

function VenueBeacon({
  district,
  focused,
  open,
}: {
  district: WorldDistrict;
  focused: boolean;
  open: boolean;
}) {
  const beamRef = useRef<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null>(null);
  const ringRef = useRef<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (beamRef.current) {
      beamRef.current.material.opacity = open ? 0.28 : focused ? 0.22 + Math.sin(t * 3.4) * 0.05 : 0.08;
    }
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      ringRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
    }
  });

  return (
    <group position={[0, district.shellSize[1] + 0.4, district.shellSize[2] * 0.08]}>
      <mesh ref={beamRef} position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.58, 1.45, 7.2, 24, 1, true]} />
        <meshBasicMaterial color={district.color} transparent opacity={focused ? 0.22 : 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.7, 0.045, 12, 56]} />
        <meshBasicMaterial color={district.accent} transparent opacity={open || focused ? 0.84 : 0.36} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshBasicMaterial color={district.accent} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function VenueEntrance({
  district,
  gradientTexture,
  focused,
  open,
  onClick,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  focused: boolean;
  open: boolean;
  onClick: () => void;
}) {
  const doorZ = district.shellSize[2] * 0.52;
  const glowOpacity = open ? 0.22 : focused ? 0.14 : 0.06;

  return (
    <group position={[0, 0, doorZ]} onClick={onClick}>
      <mesh position={[0, 0.08, 1.1]} receiveShadow castShadow>
        <boxGeometry args={[5.4, 0.16, 3]} />
        <meshToonMaterial color="#eef3f8" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 0.2, 2.6]} receiveShadow>
        <boxGeometry args={[3.4, 0.12, 1.6]} />
        <meshToonMaterial color="#2b3d52" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 1.45, 0.12]} castShadow>
        <boxGeometry args={[3.2, 2.8, 0.32]} />
        <meshToonMaterial color="#e2e8f0" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[-0.82, 1.26, 0.32]} castShadow>
        <boxGeometry args={[1.36, 1.86, 0.08]} />
        <meshToonMaterial color="#1f2a3a" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0.82, 1.26, 0.32]} castShadow>
        <boxGeometry args={[1.36, 1.86, 0.08]} />
        <meshToonMaterial color="#1f2a3a" gradientMap={gradientTexture} />
      </mesh>

      <SceneryModel
        path={VENUE_AWNING_PATH}
        gradientTexture={gradientTexture}
        tint="#eff5ff"
        accent={district.accent}
        footprint={[4.8, 1.8, 1.5]}
        position={[0, 2.85, 0.76]}
        rotationY={0}
        emissiveIntensity={focused ? 0.08 : 0.04}
      />

      <mesh position={[-1.6, 1.95, 0.52]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={district.accent} transparent opacity={0.8} />
      </mesh>

      <mesh position={[1.6, 1.95, 0.52]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={district.accent} transparent opacity={0.8} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, 1.2]}>
        <planeGeometry args={[4.2, 4.4]} />
        <meshBasicMaterial color={district.color} transparent opacity={glowOpacity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function InteractionMarker({
  position,
  color,
  accent,
  label,
}: {
  position: [number, number, number];
  color: string;
  accent: string;
  label: string;
}) {
  const ringRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    if (!ringRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;
    ringRef.current.scale.setScalar(1 + Math.sin(t * 3.2) * 0.08);
  });

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.78, 0.05, 16, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.82} />
      </mesh>

      <mesh position={[0, 0.54, 0]}>
        <sphereGeometry args={[0.15, 18, 18]} />
        <meshBasicMaterial color={accent} />
      </mesh>

      <Html position={[0, 0.95, 0]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-md">
          {label}
        </div>
      </Html>
    </group>
  );
}

function CentralPlaza({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const waterRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null>(null);

  useFrame((state) => {
    if (!waterRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;
    waterRef.current.material.opacity = 0.24 + Math.sin(t * 2.2) * 0.06;
    waterRef.current.rotation.z = t * 0.08;
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]} receiveShadow>
        <circleGeometry args={[12, 72]} />
        <meshToonMaterial color="#dbe5ef" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, 0]}>
        <ringGeometry args={[6.8, 9.6, 72]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3.8, 4.2, 0.38, 40]} />
          <meshToonMaterial color="#e2e8f0" gradientMap={gradientTexture} />
        </mesh>

        <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.9, 3.2, 0.22, 40]} />
          <meshToonMaterial color="#cbd5e1" gradientMap={gradientTexture} />
        </mesh>

        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[2.4, 2.4, 0.08, 40]} />
          <meshToonMaterial color="#7dd3fc" gradientMap={gradientTexture} />
        </mesh>

        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.72, 0.9, 0.62, 16]} />
          <meshToonMaterial color="#cbd5e1" gradientMap={gradientTexture} />
        </mesh>

        <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.26}>
          <mesh position={[0, 1.38, 0]}>
            <sphereGeometry args={[0.2, 18, 18]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.7} />
          </mesh>
        </Float>

        <mesh ref={waterRef} rotation-x={-Math.PI / 2} position={[0, 0.32, 0]}>
          <ringGeometry args={[1.3, 1.8, 40]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.26} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <ParkBench gradientTexture={gradientTexture} position={[-7.8, 0, -1]} rotationY={Math.PI * 0.42} />
      <ParkBench gradientTexture={gradientTexture} position={[7.8, 0, 1]} rotationY={-Math.PI * 0.58} />
      <ParkBench gradientTexture={gradientTexture} position={[-10.2, 0, 8.8]} rotationY={Math.PI * 0.14} />
      <ParkBench gradientTexture={gradientTexture} position={[10.2, 0, 8.8]} rotationY={-Math.PI * 0.14} />
    </group>
  );
}

function ParkBench({
  gradientTexture,
  position,
  rotationY,
}: {
  gradientTexture: THREE.DataTexture;
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.1, 0.38]} />
        <meshToonMaterial color="#8b5a3c" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 0.94, -0.12]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.1, 0.26]} />
        <meshToonMaterial color="#8b5a3c" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 0.76, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.46, 0.08]} />
        <meshToonMaterial color="#8b5a3c" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[-0.7, 0.26, 0]} castShadow>
        <boxGeometry args={[0.08, 0.46, 0.08]} />
        <meshToonMaterial color="#1f2937" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0.7, 0.26, 0]} castShadow>
        <boxGeometry args={[0.08, 0.46, 0.08]} />
        <meshToonMaterial color="#1f2937" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[-0.7, 0.26, -0.18]} castShadow>
        <boxGeometry args={[0.08, 0.46, 0.08]} />
        <meshToonMaterial color="#1f2937" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0.7, 0.26, -0.18]} castShadow>
        <boxGeometry args={[0.08, 0.46, 0.08]} />
        <meshToonMaterial color="#1f2937" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

function TownNpcs({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const walkers = useMemo(
    () => [
      {
        id: "npc-walker-a",
        center: [0, 0, 0] as [number, number, number],
        radiusX: 9,
        radiusZ: 6,
        speed: 0.22,
        offset: 0,
        tint: "#f8fafc",
        accent: "#67e8f9",
      },
      {
        id: "npc-walker-b",
        center: [0, 0, 0] as [number, number, number],
        radiusX: 7,
        radiusZ: 10,
        speed: 0.18,
        offset: Math.PI * 0.6,
        tint: "#fef3c7",
        accent: "#f59e0b",
      },
      {
        id: "npc-walker-c",
        center: [0, 0, 0] as [number, number, number],
        radiusX: 11,
        radiusZ: 8,
        speed: 0.16,
        offset: Math.PI,
        tint: "#e0f2fe",
        accent: "#38bdf8",
      },
      {
        id: "npc-walker-d",
        center: [0, 0, 0] as [number, number, number],
        radiusX: 8,
        radiusZ: 12,
        speed: 0.2,
        offset: Math.PI * 1.5,
        tint: "#fce7f3",
        accent: "#f472b6",
      },
    ],
    [],
  );

  return (
    <>
      {walkers.map((walker) => (
        <TownNpcWalker key={walker.id} gradientTexture={gradientTexture} {...walker} />
      ))}
    </>
  );
}

function TownNpcWalker({
  center,
  radiusX,
  radiusZ,
  speed,
  offset,
  tint,
  accent,
  gradientTexture: _gradientTexture,
}: {
  center: [number, number, number];
  radiusX: number;
  radiusZ: number;
  speed: number;
  offset: number;
  tint: string;
  accent: string;
  gradientTexture: THREE.DataTexture;
}) {
  const { scene, animations } = useGLTF(NPC_MODEL_PATH);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const rootRef = useRef<THREE.Group | null>(null);
  const { actions } = useAnimations(animations, clonedScene);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);

  useLayoutEffect(() => {
    recolorNamedMaterials(clonedScene, {
      Purple: tint,
      LightBlue: accent,
      White: "#f8fafc",
      Skin: "#f2c6a0",
      Hair: "#3b2f2a",
    });

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
  }, [accent, clonedScene, tint]);

  useEffect(() => {
    const entries = Object.entries(actions ?? {});
    const walkAction =
      entries.find(([name]) => name.toLowerCase() === "walk")?.[1] ??
      entries.find(([name]) => name.toLowerCase().includes("walk"))?.[1] ??
      entries.find(([name]) => name.toLowerCase() === "sprint")?.[1] ??
      entries.find(([name]) => name.toLowerCase().includes("run"))?.[1] ??
      entries.find(([name]) => name.toLowerCase().includes("idle"))?.[1] ??
      null;

    if (!walkAction || walkActionRef.current === walkAction) {
      return;
    }

    walkAction.enabled = true;
    walkAction.reset();
    walkAction.fadeIn(0.2);
    walkAction.setEffectiveTimeScale(1.08);
    walkAction.play();

    if (walkActionRef.current) {
      walkActionRef.current.fadeOut(0.16);
    }
    walkActionRef.current = walkAction;
  }, [actions]);

  useFrame((state) => {
    if (!rootRef.current) {
      return;
    }

    const t = state.clock.elapsedTime * speed + offset;
    const x = center[0] + Math.cos(t) * radiusX;
    const z = center[2] + Math.sin(t) * radiusZ;

    const tangentX = -Math.sin(t) * radiusX;
    const tangentZ = Math.cos(t) * radiusZ;

    rootRef.current.position.set(x, center[1], z);
    rootRef.current.position.y = center[1];
    rootRef.current.rotation.y = Math.atan2(tangentX, tangentZ);
  });

  return (
    <group ref={rootRef} position={center}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.4, 20]} />
        <meshBasicMaterial color={tint} transparent opacity={0.14} />
      </mesh>

      <group scale={0.92} position={[0, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function TrafficCars({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <>
      {TRAFFIC_CARS.map((car) => (
        <TrafficCar key={car.id} gradientTexture={gradientTexture} {...car} />
      ))}
    </>
  );
}

function TrafficCar({
  path,
  tint,
  accent,
  speed,
  offset,
  route,
  footprint,
  gradientTexture,
}: {
  path: string;
  tint: string;
  accent: string;
  speed: number;
  offset: number;
  route: readonly [number, number, number][];
  footprint: [number, number, number];
  gradientTexture: THREE.DataTexture;
}) {
  const rootRef = useRef<THREE.Group | null>(null);
  const routeData = useMemo(() => createRouteGeometry(route), [route]);
  const sampledPosition = useMemo(() => new THREE.Vector3(), []);
  const sampledDirection = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useFrame((state) => {
    if (!rootRef.current || routeData.totalLength <= 0) {
      return;
    }

    const travelDistance = state.clock.elapsedTime * speed + offset;
    sampleRoute(routeData, travelDistance, sampledPosition, sampledDirection);

    rootRef.current.position.copy(sampledPosition);
    rootRef.current.position.y = 0.02 + Math.sin(state.clock.elapsedTime * 3.4 + offset) * 0.015;
    rootRef.current.rotation.y = Math.atan2(sampledDirection.x, sampledDirection.z);
  });

  return (
    <group ref={rootRef}>
      <SceneryModel
        path={path}
        gradientTexture={gradientTexture}
        tint={tint}
        accent={accent}
        footprint={footprint}
        position={[0, 0, 0]}
        rotationY={0}
        emissiveIntensity={0.08}
      />
    </group>
  );
}

function createRouteGeometry(points: readonly [number, number, number][]) {
  const segments: Array<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
  }> = [];

  if (points.length < 2) {
    return { segments, totalLength: 0 };
  }

  let totalLength = 0;
  for (let index = 0; index < points.length; index += 1) {
    const startRaw = points[index];
    const endRaw = points[(index + 1) % points.length];
    const start = new THREE.Vector3(startRaw[0], startRaw[1], startRaw[2]);
    const end = new THREE.Vector3(endRaw[0], endRaw[1], endRaw[2]);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 0.001) {
      continue;
    }
    direction.divideScalar(length);
    segments.push({ start, end, direction, length });
    totalLength += length;
  }

  return { segments, totalLength };
}

function sampleRoute(
  route: {
    segments: Array<{ start: THREE.Vector3; end: THREE.Vector3; direction: THREE.Vector3; length: number }>;
    totalLength: number;
  },
  distance: number,
  outPosition: THREE.Vector3,
  outDirection: THREE.Vector3,
) {
  if (route.totalLength <= 0 || route.segments.length === 0) {
    outPosition.set(0, 0, 0);
    outDirection.set(0, 0, 1);
    return;
  }

  let remaining = THREE.MathUtils.euclideanModulo(distance, route.totalLength);
  for (const segment of route.segments) {
    if (remaining <= segment.length) {
      const t = segment.length <= 0 ? 0 : remaining / segment.length;
      outPosition.lerpVectors(segment.start, segment.end, t);
      outDirection.copy(segment.direction);
      return;
    }
    remaining -= segment.length;
  }

  const fallback = route.segments[route.segments.length - 1];
  outPosition.copy(fallback.end);
  outDirection.copy(fallback.direction);
}

function DistrictGlowRings({ districts }: { districts: WorldDistrict[] }) {
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);

  return (
    <>
      {districts.map((district) => (
        <DistrictGlowRing key={district.id} district={district} focused={nearDistrictId === district.id} />
      ))}
    </>
  );
}

function DistrictGlowRing({ district, focused }: { district: WorldDistrict; focused: boolean }) {
  const ringRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null>(null);

  useFrame((state) => {
    if (!ringRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;
    ringRef.current.material.opacity = focused ? 0.18 + Math.sin(t * 3) * 0.035 : 0.075;
    ringRef.current.scale.setScalar(focused ? 1.02 + Math.sin(t * 2.5) * 0.025 : 1);
  });

  return (
    <mesh ref={ringRef} position={[district.position[0], 0.24, district.position[2]]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[district.zoneRadius + 0.45, district.zoneRadius + 0.76, 56]} />
      <meshBasicMaterial color={district.accent} transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SceneryModel({
  path,
  gradientTexture,
  tint,
  accent,
  footprint,
  position,
  rotationY,
  emissiveIntensity,
  swayAmp = 0,
  swaySpeed = 0,
  swayPhase = 0,
}: {
  path: string;
  gradientTexture: THREE.DataTexture;
  tint: string;
  accent: string;
  footprint: [number, number, number];
  position: [number, number, number];
  rotationY: number;
  emissiveIntensity: number;
  swayAmp?: number;
  swaySpeed?: number;
  swayPhase?: number;
}) {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const fit = useMemo(() => computeObjectFit(clonedScene, footprint), [clonedScene, footprint]);
  const swayRef = useRef<THREE.Group | null>(null);

  useLayoutEffect(() => {
    applyToonLook(clonedScene, gradientTexture, {
      tint,
      tintStrength: 0.06,
      emissive: accent,
      emissiveIntensity,
    });

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = false;
      }
    });
  }, [accent, clonedScene, emissiveIntensity, gradientTexture, tint]);

  useFrame((state) => {
    if (!swayRef.current || swayAmp <= 0 || swaySpeed <= 0) {
      return;
    }

    const t = state.clock.elapsedTime * swaySpeed + swayPhase;
    swayRef.current.rotation.x = Math.sin(t * 0.82) * swayAmp * 0.45;
    swayRef.current.rotation.z = Math.sin(t) * swayAmp;
  });

  return (
    <group position={position} rotation-y={rotationY}>
      <group ref={swayRef} scale={fit.scale}>
        <primitive object={clonedScene} position={fit.groundedPosition} />
      </group>
    </group>
  );
}

function createTreeLine(
  prefix: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): SceneModelSpec[] {
  const count = 6;
  const denominator = count - 1;
  return Array.from({ length: count }).map((_, index) => {
    const t = denominator === 0 ? 0 : index / denominator;
    const x = THREE.MathUtils.lerp(startX, endX, t);
    const z = THREE.MathUtils.lerp(startZ, endZ, t);
    const isLarge = index % 2 === 0;
    return {
      id: `${prefix}-${index}`,
      path: isLarge ? "/models/kenney-suburban/tree-large.glb" : "/models/kenney-suburban/tree-small.glb",
      footprint: isLarge ? [4.8, 8.8, 4.8] : [3.8, 7, 3.8],
      position: [x, 0, z],
      tint: "#eefaf0",
      accent: "#4ade80",
      swayAmp: isLarge ? 0.042 : 0.03,
      swaySpeed: 0.8 + (index % 4) * 0.12,
      swayPhase: index * 0.7,
    };
  });
}

function getSupportModelsForDistrict(districtId: string) {
  const index =
    Math.abs(Array.from(districtId).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0)) %
    SUPPORT_MODEL_PATHS.length;
  const nextIndex = (index + 1) % SUPPORT_MODEL_PATHS.length;
  return [SUPPORT_MODEL_PATHS[index], SUPPORT_MODEL_PATHS[nextIndex]] as const;
}
