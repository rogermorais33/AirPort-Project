"use client";

import { Float, Sparkles, Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { applyToonLook, computeObjectFit } from "@/components/world/model-utils";
import {
  PATH_POINTS,
  WORLD_BOUNDS,
  WORLD_BUILDINGS,
  WORLD_LAMPS,
  WORLD_PROPS,
  WORLD_TREES,
} from "@/components/world/world-config";
import type { Vec3Tuple, WorldBuildingDefinition, WorldPropDefinition, WorldTreeDefinition } from "@/components/world/world-types";
import { seededNoise } from "@/components/world/world-utils";

interface WorldMapProps {
  gradientTexture: THREE.DataTexture;
}

interface PathStripProps {
  from: Vec3Tuple;
  to: Vec3Tuple;
  width: number;
  color: string;
  y?: number;
  stripe?: boolean;
}

export function WorldMap({ gradientTexture }: WorldMapProps) {
  return (
    <group>
      <Atmosphere />
      <Terrain gradientTexture={gradientTexture} />
      <PathNetwork gradientTexture={gradientTexture} />
      <CityBuildings gradientTexture={gradientTexture} />
      <LargeProps gradientTexture={gradientTexture} />
      <AirportInfrastructure gradientTexture={gradientTexture} />
      <InstancedTrees gradientTexture={gradientTexture} />
      <InstancedLamps gradientTexture={gradientTexture} />
      <DistantWorld gradientTexture={gradientTexture} />
      <AmbientDrones gradientTexture={gradientTexture} />
    </group>
  );
}

export function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color("#245b8f") },
      midColor: { value: new THREE.Color("#92cff2") },
      horizonColor: { value: new THREE.Color("#ffe2ad") },
      groundColor: { value: new THREE.Color("#285967") },
    }),
    [],
  );

  const clouds = useMemo(
    () => [
      { id: "c1", position: [-72, 31, -120] as Vec3Tuple, size: [64, 9] as [number, number], color: "#eef8ff", opacity: 0.28 },
      { id: "c2", position: [52, 25, -86] as Vec3Tuple, size: [44, 7] as [number, number], color: "#fff0d3", opacity: 0.22 },
      { id: "c3", position: [6, 22, -145] as Vec3Tuple, size: [78, 12] as [number, number], color: "#e0f2fe", opacity: 0.17 },
      { id: "c4", position: [-110, 21, -158] as Vec3Tuple, size: [70, 8] as [number, number], color: "#f8fafc", opacity: 0.13 },
      { id: "c5", position: [106, 23, -155] as Vec3Tuple, size: [66, 9] as [number, number], color: "#fff7ed", opacity: 0.15 },
      { id: "c6", position: [-18, 18, 120] as Vec3Tuple, size: [58, 7] as [number, number], color: "#f0f9ff", opacity: 0.12 },
    ],
    [],
  );

  return (
    <group>
      <mesh renderOrder={-100} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[560, 56, 28]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`
            varying vec3 vWorldPosition;

            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 topColor;
            uniform vec3 midColor;
            uniform vec3 horizonColor;
            uniform vec3 groundColor;
            varying vec3 vWorldPosition;

            void main() {
              float h = normalize(vWorldPosition).y;
              float skyMix = smoothstep(-0.08, 0.78, h);
              vec3 lower = mix(groundColor, horizonColor, smoothstep(-0.22, 0.08, h));
              vec3 upper = mix(midColor, topColor, smoothstep(0.18, 0.92, h));
              vec3 color = mix(lower, upper, skyMix);
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>

      <group position={[108, 88, -170]}>
        <mesh>
          <circleGeometry args={[9.5, 56]} />
          <meshBasicMaterial color="#ffe7b0" transparent opacity={0.82} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.5]}>
          <circleGeometry args={[25, 56]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      {clouds.map((cloud) => (
        <Float key={cloud.id} speed={0.34} rotationIntensity={0.035} floatIntensity={0.12}>
          <mesh position={cloud.position}>
            <planeGeometry args={cloud.size} />
            <meshBasicMaterial color={cloud.color} transparent opacity={cloud.opacity} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function Terrain({ gradientTexture }: WorldMapProps) {
  return (
    <group>
      <mesh position={[0, -0.42, 0]} receiveShadow>
        <cylinderGeometry args={[WORLD_BOUNDS.halfSize + 16, WORLD_BOUNDS.halfSize + 24, 1.25, 28]} />
        <meshToonMaterial color="#3a775e" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, -1.14, 0]} receiveShadow>
        <cylinderGeometry args={[WORLD_BOUNDS.halfSize + 24, WORLD_BOUNDS.halfSize + 35, 1.4, 28]} />
        <meshToonMaterial color="#204f56" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, -1.84, 0]} renderOrder={-10}>
        <planeGeometry args={[720, 720]} />
        <meshBasicMaterial color="#0e7490" transparent opacity={0.7} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[WORLD_BOUNDS.halfSize + 5, 28]} />
        <meshToonMaterial color="#68a779" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.032, 0]} receiveShadow>
        <ringGeometry args={[WORLD_BOUNDS.halfSize - 9, WORLD_BOUNDS.halfSize - 1.8, 72]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[20.2, 20.6, 72]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PathNetwork({ gradientTexture }: WorldMapProps) {
  const center = PATH_POINTS[0];

  return (
    <group>
      <mesh position={[0, 0.09, 10]} receiveShadow>
        <cylinderGeometry args={[13.8, 14.2, 0.16, 48]} />
        <meshStandardMaterial color="#78958e" roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 10]}>
        <ringGeometry args={[9.4, 9.74, 64]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.46} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.12, 34]} receiveShadow>
        <cylinderGeometry args={[7.2, 7.5, 0.16, 40]} />
        <meshStandardMaterial color="#607987" roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.22, 34]}>
        <ringGeometry args={[4.7, 4.98, 56]} />
        <meshBasicMaterial color="#dff6ff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {PATH_POINTS.slice(1, 7).map((point, index) => (
        <PathStrip
          key={`${point[0]}-${point[2]}`}
          from={center}
          to={point}
          width={point[2] > 40 || index === 1 ? 5.4 : 4.4}
          color={point[2] > 40 ? "#668782" : point[2] < -40 ? "#5d6d85" : "#627f86"}
          stripe
        />
      ))}

      <PathStrip from={[0, 0, 34]} to={[0, 0, 10]} width={5.8} color="#6f928d" y={0.13} stripe />
      <PathStrip from={[-64, 0, 42]} to={[-35, 0, 71]} width={2.8} color="#637d78" y={0.14} />
      <PathStrip from={[23, 0, 73]} to={[-23, 0, 73]} width={3.4} color="#5e7380" y={0.14} stripe />
      <PathStrip from={[32, 0, -66]} to={[67, 0, -35]} width={2.8} color="#604f69" y={0.14} />
      <PathStrip from={[-70, 0, 13]} to={[-33, 0, -12]} width={2.7} color="#79644f" y={0.14} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.16, 10]}>
        <ringGeometry args={[43, 44.2, 96]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.18, 10]}>
        <ringGeometry args={[42.8, 43, 96]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group position={[0, 0, 10]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 7.4, 0, 9.6]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.18, 1.8, 6]} />
              <meshToonMaterial color="#163244" gradientMap={gradientTexture} />
            </mesh>
            <mesh position={[0, 2.05, 0]}>
              <sphereGeometry args={[0.25, 14, 14]} />
              <meshBasicMaterial color="#dff6ff" transparent opacity={0.86} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function PathStrip({ from, to, width, color, y = 0.12, stripe = false }: PathStripProps) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const midX = (from[0] + to[0]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  return (
    <group position={[midX, y, midZ]} rotation-y={angle}>
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.12, length]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.06} />
      </mesh>
      {stripe ? (
        <mesh position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[Math.max(0.16, width * 0.08), length * 0.9]} />
          <meshBasicMaterial color="#dff6ff" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function CityBuildings({ gradientTexture }: WorldMapProps) {
  return (
    <group>
      {WORLD_BUILDINGS.map((building) => (
        <BuildingBlock key={building.id} building={building} gradientTexture={gradientTexture} />
      ))}
    </group>
  );
}

function BuildingBlock({ building, gradientTexture }: { building: WorldBuildingDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group position={building.position} rotation-y={building.rotationY ?? 0}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[building.size[0] + 1.2, 0.1, building.size[2] + 1.2]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.13} />
      </mesh>

      {building.modelPath ? (
        <Suspense fallback={<ProceduralBuilding building={building} gradientTexture={gradientTexture} />}>
          <CityAssetModel building={building} gradientTexture={gradientTexture} />
        </Suspense>
      ) : (
        <ProceduralBuilding building={building} gradientTexture={gradientTexture} />
      )}

      <BuildingWindows building={building} />
      <RoofDetail building={building} gradientTexture={gradientTexture} />
    </group>
  );
}

function CityAssetModel({ building, gradientTexture }: { building: WorldBuildingDefinition; gradientTexture: THREE.DataTexture }) {
  const { scene } = useGLTF(building.modelPath ?? "");
  const object = useMemo(() => scene.clone(true), [scene]);
  const targetSize = useMemo(
    () => [building.size[0], building.size[1], building.size[2]] as [number, number, number],
    [building.size],
  );
  const fit = useMemo(() => computeObjectFit(object, targetSize), [object, targetSize]);

  useLayoutEffect(() => {
    applyToonLook(object, gradientTexture, {
      tint: building.color,
      tintStrength: 0.18,
      emissive: building.accent ?? "#000000",
      emissiveIntensity: 0.018,
    });
  }, [building.accent, building.color, gradientTexture, object]);

  return (
    <group scale={fit.scale}>
      <primitive object={object} position={fit.groundedPosition.toArray()} />
    </group>
  );
}

function ProceduralBuilding({ building, gradientTexture }: { building: WorldBuildingDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <mesh position={[0, building.size[1] / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={building.size} />
      <meshToonMaterial color={building.color} gradientMap={gradientTexture} />
    </mesh>
  );
}

function BuildingWindows({ building }: { building: WorldBuildingDefinition }) {
  const floors = Math.max(2, Math.floor(building.size[1] / 2.4));
  const columns = Math.max(2, Math.floor(building.size[0] / 2.9));
  const windowColor = building.accent ?? "#dbeafe";
  const frontZ = building.size[2] / 2 + 0.035;
  const backZ = -building.size[2] / 2 - 0.035;

  return (
    <group>
      {Array.from({ length: floors }, (_, floor) =>
        Array.from({ length: columns }, (_, column) => {
          const x = ((column + 0.5) / columns - 0.5) * building.size[0] * 0.72;
          const y = 1.15 + floor * (building.size[1] - 2) / Math.max(1, floors);
          return (
            <group key={`${floor}-${column}`}>
              <mesh position={[x, y, frontZ]}>
                <planeGeometry args={[0.46, 0.25]} />
                <meshBasicMaterial color={windowColor} transparent opacity={0.34} depthWrite={false} />
              </mesh>
              <mesh position={[-x, y, backZ]} rotation-y={Math.PI}>
                <planeGeometry args={[0.46, 0.25]} />
                <meshBasicMaterial color={windowColor} transparent opacity={0.2} depthWrite={false} />
              </mesh>
            </group>
          );
        }),
      )}
    </group>
  );
}

function RoofDetail({ building, gradientTexture }: { building: WorldBuildingDefinition; gradientTexture: THREE.DataTexture }) {
  const roofY = building.size[1] + 0.22;
  const accent = building.accent ?? "#bae6fd";

  if (building.roof === "beacon") {
    return (
      <group position={[0, roofY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.42, 0.72, 8]} />
          <meshToonMaterial color="#1e293b" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <octahedronGeometry args={[0.42, 1]} />
          <meshBasicMaterial color={accent} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.68, 0]} scale={2.1}>
          <octahedronGeometry args={[0.42, 1]} />
          <meshBasicMaterial color={accent} transparent opacity={0.13} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (building.roof === "radar") {
    return (
      <group position={[0, roofY + 0.1, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 1.2, 6]} />
          <meshToonMaterial color="#172033" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[0, 1.22, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.92, 0.035, 8, 48]} />
          <meshBasicMaterial color={accent} transparent opacity={0.68} />
        </mesh>
      </group>
    );
  }

  if (building.roof === "antenna") {
    return (
      <group position={[0, roofY, 0]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.1, 2.2, 6]} />
          <meshToonMaterial color="#172033" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[0, 2.35, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color={accent} transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }

  if (building.roof === "garden") {
    return (
      <group position={[0, roofY, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[building.size[0] * 0.54, 0.22, building.size[2] * 0.54]} />
          <meshToonMaterial color="#2f855a" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[building.size[0] * 0.2, 0.42, building.size[2] * 0.16]} castShadow>
          <coneGeometry args={[0.45, 1.1, 7]} />
          <meshToonMaterial color="#166534" gradientMap={gradientTexture} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, roofY, 0]} castShadow receiveShadow>
      <boxGeometry args={[building.size[0] * 0.5, 0.32, building.size[2] * 0.5]} />
      <meshToonMaterial color="#1e293b" gradientMap={gradientTexture} />
    </mesh>
  );
}

function LargeProps({ gradientTexture }: WorldMapProps) {
  return (
    <group>
      {WORLD_PROPS.map((prop) => (
        <WorldProp key={prop.id} prop={prop} gradientTexture={gradientTexture} />
      ))}
    </group>
  );
}

function WorldProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group position={prop.position} rotation-y={prop.rotationY ?? 0}>
      {prop.kind === "cargo" ? <CargoProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "terminal" ? <TerminalProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "gate" ? <GateProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "rock" ? <RockProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "antenna" ? <AntennaProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "platform" ? <PlatformProp prop={prop} /> : null}
      {prop.kind === "hangar" ? <HangarProp prop={prop} gradientTexture={gradientTexture} /> : null}
      {prop.kind === "sign" ? <SignProp prop={prop} gradientTexture={gradientTexture} /> : null}
    </group>
  );
}

function CargoProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={prop.size} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] + 0.08, 0]} castShadow>
        <boxGeometry args={[prop.size[0] * 0.92, 0.14, prop.size[2] * 0.88]} />
        <meshBasicMaterial color={prop.accent ?? "#e0f2fe"} transparent opacity={0.44} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * prop.size[0] * 0.25, prop.size[1] * 0.58, prop.size[2] / 2 + 0.03]}>
          <planeGeometry args={[prop.size[0] * 0.18, prop.size[1] * 0.54]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function TerminalProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={prop.size} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] + 0.24, 0]} castShadow>
        <cylinderGeometry args={[prop.size[0] * 0.24, prop.size[0] * 0.3, 0.52, 8]} />
        <meshToonMaterial color={prop.accent ?? "#dbeafe"} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] * 0.62, prop.size[2] / 2 + 0.04]}>
        <planeGeometry args={[prop.size[0] * 0.64, prop.size[1] * 0.22]} />
        <meshBasicMaterial color={prop.accent ?? "#dbeafe"} transparent opacity={0.42} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GateProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * prop.size[0] * 0.47, prop.size[1] / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.72, prop.size[1], prop.size[2]]} />
          <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
        </mesh>
      ))}
      <mesh position={[0, prop.size[1] - 0.35, 0]} castShadow>
        <boxGeometry args={[prop.size[0], 0.7, prop.size[2] * 0.9]} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <Float speed={0.5} rotationIntensity={0.02} floatIntensity={0.08}>
        <Text color={prop.accent ?? "#bfdbfe"} fontSize={0.52} anchorX="center" anchorY="middle" position={[0, prop.size[1] - 0.3, -1.05]}>
          GAZEPILOT
        </Text>
      </Float>
    </group>
  );
}

function RockProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] * 0.43, 0]} scale={[prop.size[0], prop.size[1], prop.size[2]]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[prop.size[0] * 0.28, prop.size[1] * 0.28, -prop.size[2] * 0.18]} scale={[prop.size[0] * 0.45, prop.size[1] * 0.6, prop.size[2] * 0.4]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshToonMaterial color="#436362" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

function AntennaProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] * 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[prop.size[0] * 0.32, prop.size[0] * 0.42, prop.size[1] * 0.36, 8]} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] * 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, prop.size[1] * 0.9, 8]} />
        <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] * 1.18, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[prop.size[0] * 0.55, 0.045, 8, 64]} />
        <meshBasicMaterial color={prop.accent ?? "#67e8f9"} transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function PlatformProp({ prop }: { prop: WorldPropDefinition }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] / 2, 0]} receiveShadow>
        <boxGeometry args={prop.size} />
        <meshStandardMaterial color={prop.color} roughness={0.78} metalness={0.08} />
      </mesh>
      {[-8, 0, 8].map((x) => (
        <mesh key={x} position={[x, prop.size[1] + 0.04, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.3, prop.size[2] * 0.72]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.64} />
        </mesh>
      ))}
    </group>
  );
}

function HangarProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={prop.size} />
        <meshToonMaterial color={prop.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] + 0.18, 0]} castShadow>
        <boxGeometry args={[prop.size[0] * 0.92, 0.36, prop.size[2] * 0.94]} />
        <meshToonMaterial color={prop.accent ?? "#dbeafe"} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1] * 0.45, prop.size[2] / 2 + 0.04]}>
        <planeGeometry args={[prop.size[0] * 0.72, prop.size[1] * 0.42]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.36} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SignProp({ prop, gradientTexture }: { prop: WorldPropDefinition; gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh position={[0, prop.size[1] * 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, prop.size[1] * 0.9, 6]} />
        <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, prop.size[1], 0]}>
        <boxGeometry args={[prop.size[0], prop.size[1] * 0.28, 0.16]} />
        <meshBasicMaterial color={prop.color} />
      </mesh>
    </group>
  );
}

function AirportInfrastructure({ gradientTexture }: WorldMapProps) {
  const shuttleRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    if (shuttleRef.current) {
      shuttleRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.22) * 10;
      shuttleRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
    }
  });

  return (
    <group position={[0, 0, 88]}>
      <Float speed={0.4} rotationIntensity={0.02} floatIntensity={0.12}>
        <group ref={shuttleRef} position={[0, 7.8, -5]}>
          <mesh castShadow>
            <boxGeometry args={[7.2, 0.72, 1.55]} />
            <meshToonMaterial color="#e0f2fe" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, -0.48, 0]}>
            <boxGeometry args={[4.2, 0.2, 1]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.75} />
          </mesh>
          <mesh position={[-3.5, 0.04, 0]} rotation-z={0.25}>
            <boxGeometry args={[1.6, 0.18, 3.2]} />
            <meshToonMaterial color="#bfdbfe" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[3.5, 0.04, 0]} rotation-z={-0.25}>
            <boxGeometry args={[1.6, 0.18, 3.2]} />
            <meshToonMaterial color="#bfdbfe" gradientMap={gradientTexture} />
          </mesh>
        </group>
      </Float>

      {[-14, 14].map((x) => (
        <group key={x} position={[x, 0, -6]}>
          <mesh position={[0, 2.55, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.78, 5.1, 8]} />
            <meshToonMaterial color="#334155" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, 5.45, 0]}>
            <sphereGeometry args={[0.52, 16, 16]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function InstancedTrees({ gradientTexture }: WorldMapProps) {
  const trunkRef = useRef<THREE.InstancedMesh | null>(null);
  const pineRef = useRef<THREE.InstancedMesh | null>(null);
  const broadleafRef = useRef<THREE.InstancedMesh | null>(null);
  const palmRef = useRef<THREE.InstancedMesh | null>(null);
  const palmLeafRef = useRef<THREE.InstancedMesh | null>(null);

  const treeGroups = useMemo(
    () => ({
      all: WORLD_TREES,
      pine: WORLD_TREES.filter((tree) => tree.variant === "pine"),
      broadleaf: WORLD_TREES.filter((tree) => tree.variant === "broadleaf"),
      palm: WORLD_TREES.filter((tree) => tree.variant === "palm"),
    }),
    [],
  );

  useLayoutEffect(() => {
    writeTreeMatrices(trunkRef.current, treeGroups.all, (tree, matrix, quaternion, scale) => {
      scale.set(tree.scale * 0.34, tree.scale * 0.95, tree.scale * 0.34);
      matrix.compose(new THREE.Vector3(tree.position[0], 0.76 * tree.scale, tree.position[2]), quaternion, scale);
    });

    writeTreeMatrices(pineRef.current, treeGroups.pine, (tree, matrix, quaternion, scale) => {
      scale.setScalar(tree.scale);
      matrix.compose(new THREE.Vector3(tree.position[0], 1.74 * tree.scale, tree.position[2]), quaternion, scale);
    });

    writeTreeMatrices(broadleafRef.current, treeGroups.broadleaf, (tree, matrix, quaternion, scale) => {
      scale.set(tree.scale * 0.95, tree.scale * 0.86, tree.scale * 0.95);
      matrix.compose(new THREE.Vector3(tree.position[0], 1.72 * tree.scale, tree.position[2]), quaternion, scale);
    });

    writeTreeMatrices(palmRef.current, treeGroups.palm, (tree, matrix, quaternion, scale) => {
      scale.set(tree.scale * 0.7, tree.scale * 0.92, tree.scale * 0.7);
      matrix.compose(new THREE.Vector3(tree.position[0], 1.82 * tree.scale, tree.position[2]), quaternion, scale);
    });

    writeTreeMatrices(palmLeafRef.current, treeGroups.palm, (tree, matrix, quaternion, scale) => {
      scale.set(tree.scale * 1.15, tree.scale * 0.34, tree.scale * 1.15);
      matrix.compose(new THREE.Vector3(tree.position[0], 2.55 * tree.scale, tree.position[2]), quaternion, scale);
    });
  }, [treeGroups]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, treeGroups.all.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.24, 1.45, 7]} />
        <meshToonMaterial color="#7c4a2d" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={pineRef} args={[undefined, undefined, treeGroups.pine.length]} castShadow receiveShadow>
        <coneGeometry args={[1.08, 2.35, 7]} />
        <meshToonMaterial color="#2f855a" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={broadleafRef} args={[undefined, undefined, treeGroups.broadleaf.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1.03, 1]} />
        <meshToonMaterial color="#3f8f5f" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={palmRef} args={[undefined, undefined, treeGroups.palm.length]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshToonMaterial color="#2f855a" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={palmLeafRef} args={[undefined, undefined, treeGroups.palm.length]} castShadow receiveShadow>
        <coneGeometry args={[1.05, 1, 7]} />
        <meshToonMaterial color="#2f9b6b" gradientMap={gradientTexture} />
      </instancedMesh>
    </group>
  );
}

function writeTreeMatrices(
  mesh: THREE.InstancedMesh | null,
  trees: WorldTreeDefinition[],
  write: (tree: WorldTreeDefinition, matrix: THREE.Matrix4, quaternion: THREE.Quaternion, scale: THREE.Vector3) => void,
) {
  if (!mesh) {
    return;
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  trees.forEach((tree, index) => {
    write(tree, matrix, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
}

function InstancedLamps({ gradientTexture }: WorldMapProps) {
  const poleRef = useRef<THREE.InstancedMesh | null>(null);
  const glowRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    WORLD_LAMPS.forEach((lamp, index) => {
      const height = lamp.height ?? 3.1;
      scale.set(1, height / 3.1, 1);
      matrix.compose(new THREE.Vector3(lamp.position[0], height * 0.5, lamp.position[2]), quaternion, scale);
      poleRef.current?.setMatrixAt(index, matrix);
      scale.setScalar(1);
      matrix.compose(new THREE.Vector3(lamp.position[0], height + 0.18, lamp.position[2]), quaternion, scale);
      glowRef.current?.setMatrixAt(index, matrix);
    });

    if (poleRef.current) {
      poleRef.current.instanceMatrix.needsUpdate = true;
    }
    if (glowRef.current) {
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, WORLD_LAMPS.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.13, 3.1, 6]} />
        <meshToonMaterial color="#1e293b" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, WORLD_LAMPS.length]}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.84} />
      </instancedMesh>
    </group>
  );
}

function DistantWorld({ gradientTexture }: WorldMapProps) {
  const skyline = useMemo(
    () =>
      Array.from({ length: 56 }, (_, index) => {
        const angle = -Math.PI * 0.8 + (index / 55) * Math.PI * 1.6;
        const radius = 155 + seededNoise(index + 60) * 22;
        return {
          id: `skyline-${index}`,
          position: [Math.sin(angle) * radius, 2.5 + seededNoise(index + 2) * 5, Math.cos(angle) * radius] as Vec3Tuple,
          size: [2.2 + seededNoise(index + 3) * 5, 4 + seededNoise(index + 4) * 12, 2.4 + seededNoise(index + 5) * 3.2] as Vec3Tuple,
          color: index % 3 === 0 ? "#4f6f83" : index % 3 === 1 ? "#375268" : "#66879a",
        };
      }),
    [],
  );

  const mountains = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2;
        const radius = 150 + seededNoise(index + 80) * 34;
        return {
          id: `mountain-${index}`,
          position: [Math.sin(angle) * radius, 3.5, Math.cos(angle) * radius] as Vec3Tuple,
          scale: [13 + seededNoise(index) * 22, 13 + seededNoise(index + 9) * 26, 13 + seededNoise(index + 22) * 22] as Vec3Tuple,
        };
      }),
    [],
  );

  return (
    <group>
      {mountains.map((mountain) => (
        <mesh key={mountain.id} position={mountain.position} scale={mountain.scale} castShadow={false} receiveShadow>
          <coneGeometry args={[1, 1, 5]} />
          <meshToonMaterial color="#577b7d" gradientMap={gradientTexture} />
        </mesh>
      ))}

      {skyline.map((building) => (
        <mesh key={building.id} position={building.position} castShadow={false} receiveShadow>
          <boxGeometry args={building.size} />
          <meshToonMaterial color={building.color} gradientMap={gradientTexture} />
        </mesh>
      ))}
    </group>
  );
}

function AmbientDrones({ gradientTexture }: WorldMapProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const routeRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
    if (routeRef.current) {
      routeRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.33) * 28;
      routeRef.current.position.z = -10 + Math.cos(state.clock.elapsedTime * 0.33) * 7;
      routeRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.33) * 0.24;
    }
  });

  return (
    <group>
      <group ref={groupRef} position={[0, 17, 10]}>
        {[0, 1, 2, 3].map((index) => {
          const angle = (index / 4) * Math.PI * 2;
          return (
            <group key={index} position={[Math.sin(angle) * 35, index * 1.4, Math.cos(angle) * 35]}>
              <mesh castShadow>
                <boxGeometry args={[1.7, 0.34, 0.78]} />
                <meshToonMaterial color={index % 2 === 0 ? "#dbeafe" : "#fef3c7"} gradientMap={gradientTexture} />
              </mesh>
              <mesh position={[0, -0.26, 0]}>
                <sphereGeometry args={[0.14, 8, 8]} />
                <meshBasicMaterial color="#67e8f9" transparent opacity={0.82} />
              </mesh>
            </group>
          );
        })}
      </group>

      <group ref={routeRef} position={[0, 10.6, -10]}>
        <mesh castShadow>
          <boxGeometry args={[4.4, 0.54, 1.05]} />
          <meshToonMaterial color="#e0f2fe" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[0, -0.36, 0]}>
          <boxGeometry args={[2.8, 0.16, 0.74]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} />
        </mesh>
      </group>

      <Sparkles count={76} scale={[190, 32, 190]} position={[0, 20, 0]} size={1.45} speed={0.07} color="#e0f2fe" />
    </group>
  );
}

for (const modelPath of Array.from(new Set(WORLD_BUILDINGS.map((building) => building.modelPath).filter(Boolean)))) {
  useGLTF.preload(modelPath as string);
}
