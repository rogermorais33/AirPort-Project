"use client";

import { Float, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { PATH_POINTS, WORLD_BOUNDS } from "@/components/world/world-config";
import type { Vec3Tuple } from "@/components/world/world-types";
import { seededNoise } from "@/components/world/world-utils";
import { SKYPORT_DISTRICTS } from "@/lib/world-data";

interface WorldMapProps {
  gradientTexture: THREE.DataTexture;
}

interface PathStripProps {
  from: Vec3Tuple;
  to: Vec3Tuple;
  width: number;
  color: string;
  y?: number;
}

export function WorldMap({ gradientTexture }: WorldMapProps) {
  return (
    <group>
      <Atmosphere />
      <Terrain gradientTexture={gradientTexture} />
      <PathNetwork gradientTexture={gradientTexture} />
      <CentralSkyport gradientTexture={gradientTexture} />
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
      topColor: { value: new THREE.Color("#2f6ea4") },
      midColor: { value: new THREE.Color("#9bcff0") },
      horizonColor: { value: new THREE.Color("#ffdca8") },
      groundColor: { value: new THREE.Color("#245866") },
    }),
    [],
  );

  const clouds = useMemo(
    () => [
      { id: "c1", position: [-48, 28, -96] as Vec3Tuple, size: [46, 8] as [number, number], color: "#eef8ff", opacity: 0.27 },
      { id: "c2", position: [38, 24, -74] as Vec3Tuple, size: [34, 6] as [number, number], color: "#fff0d3", opacity: 0.2 },
      { id: "c3", position: [6, 19, -114] as Vec3Tuple, size: [64, 10] as [number, number], color: "#e0f2fe", opacity: 0.17 },
      { id: "c4", position: [-88, 18, -132] as Vec3Tuple, size: [58, 7] as [number, number], color: "#f8fafc", opacity: 0.13 },
      { id: "c5", position: [88, 20, -126] as Vec3Tuple, size: [52, 8] as [number, number], color: "#fff7ed", opacity: 0.14 },
    ],
    [],
  );

  return (
    <group>
      <mesh renderOrder={-100} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[430, 48, 24]} />
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

      <group position={[88, 78, -150]}>
        <mesh>
          <circleGeometry args={[7.8, 48]} />
          <meshBasicMaterial color="#ffe7b0" transparent opacity={0.76} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.4]}>
          <circleGeometry args={[18, 48]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      {clouds.map((cloud) => (
        <Float key={cloud.id} speed={0.38} rotationIntensity={0.04} floatIntensity={0.12}>
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
      <mesh position={[0, -0.34, 0]} receiveShadow>
        <cylinderGeometry args={[WORLD_BOUNDS.halfSize + 12, WORLD_BOUNDS.halfSize + 18, 1.1, 18]} />
        <meshToonMaterial color="#326a55" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, -1.05, 0]} receiveShadow>
        <cylinderGeometry args={[WORLD_BOUNDS.halfSize + 17, WORLD_BOUNDS.halfSize + 24, 1.2, 18]} />
        <meshToonMaterial color="#1f4d4f" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, -1.72, 0]} renderOrder={-10}>
        <planeGeometry args={[560, 560]} />
        <meshBasicMaterial color="#0e7490" transparent opacity={0.66} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[WORLD_BOUNDS.halfSize + 3, 18]} />
        <meshToonMaterial color="#5ea47a" gradientMap={gradientTexture} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} receiveShadow>
        <ringGeometry args={[WORLD_BOUNDS.halfSize - 5, WORLD_BOUNDS.halfSize - 1.2, 18]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PathNetwork({ gradientTexture }: WorldMapProps) {
  const center: Vec3Tuple = PATH_POINTS[0];

  return (
    <group>
      <mesh position={[0, 0.09, 8]} receiveShadow>
        <cylinderGeometry args={[9.4, 9.8, 0.12, 24]} />
        <meshToonMaterial color="#8aa6a1" gradientMap={gradientTexture} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.17, 8]}>
        <ringGeometry args={[6.2, 6.38, 48]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.46} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group position={[0, 0, 22]}>
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <cylinderGeometry args={[4.2, 4.45, 0.12, 18]} />
          <meshToonMaterial color="#6f9891" gradientMap={gradientTexture} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
          <ringGeometry args={[2.65, 2.9, 48]} />
          <meshBasicMaterial color="#dff6ff" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 3.25, 0, -0.2]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.12, 1.1, 6]} />
              <meshToonMaterial color="#163244" gradientMap={gradientTexture} />
            </mesh>
            <mesh position={[0, 1.22, 0]}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshBasicMaterial color="#dff6ff" transparent opacity={0.78} />
            </mesh>
          </group>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.22, -3.3]}>
          <planeGeometry args={[0.34, 2.6]} />
          <meshBasicMaterial color="#dff6ff" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      </group>

      {PATH_POINTS.slice(1).map((point, index) => (
        <PathStrip
          key={`${point[0]}-${point[2]}`}
          from={center}
          to={point}
          width={index === 2 || point[2] > 20 ? 4.5 : 3.1}
          color={point[2] > 20 ? "#6f8d8a" : "#617d86"}
        />
      ))}

      <PathStrip from={[-34, 0, 23]} to={[-16, 0, 36]} width={2.2} color="#6b8a84" y={0.12} />
      <PathStrip from={[20, 0, -36]} to={[34, 0, -10]} width={2.2} color="#5e7582" y={0.12} />
      <PathStrip from={[-34, 0, 6]} to={[-21, 0, 25]} width={2.1} color="#7a7568" y={0.13} />
    </group>
  );
}

function PathStrip({ from, to, width, color, y = 0.1 }: PathStripProps) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const midX = (from[0] + to[0]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  return (
    <group position={[midX, y, midZ]} rotation-y={angle}>
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.1, length]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[Math.max(0.16, width * 0.08), length * 0.92]} />
        <meshBasicMaterial color="#dff6ff" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CentralSkyport({ gradientTexture }: WorldMapProps) {
  return (
    <group position={[0, 0, 8]}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.9, 2.35, 8]} />
        <meshToonMaterial color="#1e3a5f" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <cylinderGeometry args={[1, 1.25, 0.5, 8]} />
        <meshToonMaterial color="#60a5fa" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 3.55, 0]} castShadow>
        <octahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 3.55, 0]} scale={1.8}>
        <octahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.25, 0, 1.2]} rotation-z={side * 0.14}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[0.34, 2.15, 0.34]} />
            <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, 2.7, 0]} rotation-z={Math.PI / 4}>
            <boxGeometry args={[0.36, 0.36, 2.25]} />
            <meshBasicMaterial color="#93c5fd" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      <Sparkles count={34} scale={[17, 6, 17]} position={[0, 4, 0]} size={1.7} speed={0.16} color="#bfdbfe" />
    </group>
  );
}

function AirportInfrastructure({ gradientTexture }: WorldMapProps) {
  return (
    <group position={[0, 0, 44]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[17, 0.12, 31]} />
        <meshStandardMaterial color="#263747" roughness={0.82} metalness={0.08} />
      </mesh>
      {[-5.2, 0, 5.2].map((x) => (
        <mesh key={x} position={[x, 0.21, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.28, 23]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.64} />
        </mesh>
      ))}
      {[-8.5, 8.5].map((x) => (
        <group key={x} position={[x, 0, -9.5]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.56, 0.72, 4.4, 8]} />
            <meshToonMaterial color="#334155" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, 4.7, 0]}>
            <sphereGeometry args={[0.46, 16, 16]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
      <Float speed={0.5} rotationIntensity={0.03} floatIntensity={0.16}>
        <group position={[0, 6.7, 6]}>
          <mesh castShadow>
            <boxGeometry args={[5.6, 0.44, 1.2]} />
            <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[2.2, 0.22, 0.8]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.74} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

function InstancedTrees({ gradientTexture }: WorldMapProps) {
  const trunkRef = useRef<THREE.InstancedMesh | null>(null);
  const crownRef = useRef<THREE.InstancedMesh | null>(null);
  const trees = useMemo(() => createTreePositions(), []);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    trees.forEach((tree, index) => {
      scale.set(tree.scale * 0.38, tree.scale * 0.88, tree.scale * 0.38);
      matrix.compose(new THREE.Vector3(tree.position[0], 0.62 * tree.scale, tree.position[2]), quaternion, scale);
      trunkRef.current?.setMatrixAt(index, matrix);

      scale.setScalar(tree.scale);
      matrix.compose(new THREE.Vector3(tree.position[0], 1.62 * tree.scale, tree.position[2]), quaternion, scale);
      crownRef.current?.setMatrixAt(index, matrix);
    });

    if (trunkRef.current) {
      trunkRef.current.instanceMatrix.needsUpdate = true;
    }
    if (crownRef.current) {
      crownRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [trees]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.22, 1.4, 6]} />
        <meshToonMaterial color="#7c4a2d" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <coneGeometry args={[0.95, 2.2, 7]} />
        <meshToonMaterial color="#2f855a" gradientMap={gradientTexture} />
      </instancedMesh>
    </group>
  );
}

function InstancedLamps({ gradientTexture }: WorldMapProps) {
  const poleRef = useRef<THREE.InstancedMesh | null>(null);
  const glowRef = useRef<THREE.InstancedMesh | null>(null);
  const lamps = useMemo(
    () => [
      [-8, 0, 8],
      [8, 0, 8],
      [-16, 0, 15],
      [15, 0, 16],
      [-23, 0, 5],
      [23, 0, 1],
      [-13, 0, -13],
      [12, 0, -14],
      [-18, 0, 29],
      [10, 0, 29],
      [22, 0, -25],
      [-5, 0, -26],
    ] as Vec3Tuple[],
    [],
  );

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    lamps.forEach((lamp, index) => {
      matrix.compose(new THREE.Vector3(lamp[0], 1.25, lamp[2]), quaternion, scale);
      poleRef.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(lamp[0], 2.65, lamp[2]), quaternion, scale);
      glowRef.current?.setMatrixAt(index, matrix);
    });

    if (poleRef.current) {
      poleRef.current.instanceMatrix.needsUpdate = true;
    }
    if (glowRef.current) {
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [lamps]);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, lamps.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 2.5, 6]} />
        <meshToonMaterial color="#1e293b" gradientMap={gradientTexture} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.82} />
      </instancedMesh>
    </group>
  );
}

function DistantWorld({ gradientTexture }: WorldMapProps) {
  const skyline = useMemo(
    () =>
      Array.from({ length: 38 }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const depth = -118 - seededNoise(index) * 18;
        const x = side * (45 + seededNoise(index + 12) * 82);
        return {
          id: `skyline-${index}`,
          position: [x, 2.2 + seededNoise(index + 2) * 4.2, depth] as Vec3Tuple,
          size: [2.4 + seededNoise(index + 3) * 3.4, 4 + seededNoise(index + 4) * 8, 2.6 + seededNoise(index + 5) * 2.8] as Vec3Tuple,
          color: index % 3 === 0 ? "#4f6f83" : index % 3 === 1 ? "#375268" : "#66879a",
        };
      }),
    [],
  );

  const mountains = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const radius = 126 + seededNoise(index + 80) * 28;
        return {
          id: `mountain-${index}`,
          position: [Math.sin(angle) * radius, 4, Math.cos(angle) * radius] as Vec3Tuple,
          scale: [10 + seededNoise(index) * 18, 12 + seededNoise(index + 9) * 24, 10 + seededNoise(index + 22) * 18] as Vec3Tuple,
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
  const shuttleRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.16;
    }
    if (shuttleRef.current) {
      shuttleRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.46) * 20;
      shuttleRef.current.position.z = -6 + Math.cos(state.clock.elapsedTime * 0.46) * 5;
      shuttleRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.46) * 0.3;
    }
  });

  return (
    <group>
      <group ref={groupRef} position={[0, 13.5, 8]}>
        {[0, 1, 2].map((index) => {
          const angle = (index / 3) * Math.PI * 2;
          return (
            <group key={index} position={[Math.sin(angle) * 24, index * 1.8, Math.cos(angle) * 24]}>
              <mesh castShadow>
                <boxGeometry args={[1.4, 0.32, 0.72]} />
                <meshToonMaterial color={index === 0 ? "#dbeafe" : index === 1 ? "#fef3c7" : "#fce7f3"} gradientMap={gradientTexture} />
              </mesh>
              <mesh position={[0, -0.24, 0]}>
                <sphereGeometry args={[0.13, 8, 8]} />
                <meshBasicMaterial color="#67e8f9" transparent opacity={0.8} />
              </mesh>
            </group>
          );
        })}
      </group>

      <group ref={shuttleRef} position={[0, 8.4, -6]}>
        <mesh castShadow>
          <boxGeometry args={[3.8, 0.54, 1]} />
          <meshToonMaterial color="#e0f2fe" gradientMap={gradientTexture} />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[2.4, 0.16, 0.72]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} />
        </mesh>
      </group>
    </group>
  );
}

function createTreePositions() {
  const trees: { position: Vec3Tuple; scale: number }[] = [];

  for (let i = 0; i < 70; i += 1) {
    const angle = seededNoise(i) * Math.PI * 2;
    const radius = 36 + seededNoise(i + 4) * 28;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const nearDistrict = SKYPORT_DISTRICTS.some((district) => {
      const dx = district.position[0] - x;
      const dz = district.position[2] - z;
      return Math.sqrt(dx * dx + dz * dz) < district.zoneRadius + 3;
    });
    if (nearDistrict || Math.abs(x) < 10 || Math.abs(z - 8) < 8) {
      continue;
    }
    trees.push({
      position: [x, 0, z],
      scale: 0.78 + seededNoise(i + 11) * 0.7,
    });
  }

  return trees;
}
