"use client";

import { Float, Html, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import type { AttentionDirection } from "@/lib/gaze";
import { cn } from "@/lib/utils";

export interface ExpoBooth {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  position: [number, number, number];
  lane: number;
  row: number;
}

interface WorldExpoSceneProps {
  booths: ExpoBooth[];
  selectedBoothId: string;
  openBoothId: string | null;
  attentionDirection: AttentionDirection;
  wsStatus: string;
  motionLatencyMs: number | null;
}

export function WorldExpoScene({
  booths,
  selectedBoothId,
  openBoothId,
  attentionDirection,
  wsStatus,
  motionLatencyMs,
}: WorldExpoSceneProps) {
  const selectedBooth = booths.find((item) => item.id === selectedBoothId) ?? booths[0];

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(4,10,20,0.94),rgba(10,12,32,0.92))] shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
      <Canvas camera={{ position: [0, 6.8, 16], fov: 44 }} shadows dpr={[1, 1.5]}>
        <SceneContent booths={booths} selectedBoothId={selectedBoothId} openBoothId={openBoothId} />
        <CameraRig target={selectedBooth.position} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/65 backdrop-blur-md">
          expo world
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/65 backdrop-blur-md">
          ws {wsStatus}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 grid gap-2 p-4 md:grid-cols-3">
        <OverlayPill label="Steer" value={translateDirection(attentionDirection)} />
        <OverlayPill
          label="Motion-to-screen"
          value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`}
        />
        <OverlayPill label="Enter booth" value={openBoothId ? "blink para trocar" : "pisque para abrir"} />
      </div>
    </div>
  );
}

function SceneContent({
  booths,
  selectedBoothId,
  openBoothId,
}: {
  booths: ExpoBooth[];
  selectedBoothId: string;
  openBoothId: string | null;
}) {
  const laneMarkers = useMemo(() => [-8, 0, 8], []);

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 18, 42]} />

      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.8} color="#dbeafe" groundColor="#020617" />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[8, 16, 10]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight intensity={80} position={[0, 8, 0]} color="#67e8f9" distance={38} />
      <pointLight intensity={45} position={[0, 5, -10]} color="#f472b6" distance={24} />

      <group position={[0, -0.05, 0]}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[90, 90]} />
          <meshStandardMaterial color="#05111e" roughness={0.96} metalness={0.1} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
          <ringGeometry args={[2.8, 5.4, 64]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {laneMarkers.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <planeGeometry args={[2.4, 30]} />
            <meshStandardMaterial color="#0f1d33" emissive="#0f1d33" roughness={0.9} metalness={0.25} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <planeGeometry args={[0.2, 30]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.34} />
          </mesh>
        </group>
      ))}

      <CenterGate />

      {booths.map((booth) => (
        <ExpoBoothMesh
          key={booth.id}
          booth={booth}
          selected={booth.id === selectedBoothId}
          open={booth.id === openBoothId}
        />
      ))}

      <Sparkles count={100} scale={[30, 12, 30]} position={[0, 7, 0]} size={2.6} speed={0.24} color="#67e8f9" />
    </>
  );
}

function CenterGate() {
  return (
    <group position={[0, 0, 0]}>
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[0, 3.8, 0]}>
          <torusGeometry args={[1.8, 0.14, 16, 80]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.4} />
        </mesh>
      </Float>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.5, 1.6, 6]} />
        <meshStandardMaterial color="#0f172a" metalness={0.62} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[2.4, 2.8, 0.22, 40]} />
        <meshStandardMaterial color="#0b1120" emissive="#0ea5e9" emissiveIntensity={0.15} />
      </mesh>
      <Html position={[0, 5.4, 0]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-xs uppercase tracking-[0.26em] text-white/75 backdrop-blur-md">
          GazePilot Expo
        </div>
      </Html>
    </group>
  );
}

function ExpoBoothMesh({
  booth,
  selected,
  open,
}: {
  booth: ExpoBooth;
  selected: boolean;
  open: boolean;
}) {
  const glowColor = new THREE.Color(booth.color);
  const frameColor = selected ? glowColor.clone().lerp(new THREE.Color("#ffffff"), 0.15) : new THREE.Color("#172554");

  return (
    <group position={booth.position}>
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[2.2, 2.5, 0.32, 48]} />
        <meshStandardMaterial color="#0b1328" metalness={0.5} roughness={0.3} />
      </mesh>

      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[3.8, 2.3, 3.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.38} />
      </mesh>

      <mesh position={[0, 2.82, 0]} castShadow>
        <boxGeometry args={[4.2, 0.22, 4.2]} />
        <meshStandardMaterial color="#111827" emissive={selected ? booth.color : "#111827"} emissiveIntensity={selected ? 0.46 : 0.04} />
      </mesh>

      <mesh position={[0, 1.5, 1.92]} castShadow>
        <boxGeometry args={[2.7, 1.35, 0.12]} />
        <meshStandardMaterial color="#0b1020" emissive={booth.color} emissiveIntensity={selected ? 0.74 : 0.22} />
      </mesh>

      <mesh position={[0, 1.5, 1.99]}>
        <planeGeometry args={[2.2, 0.9]} />
        <meshBasicMaterial color={booth.color} transparent opacity={selected ? 0.42 : 0.2} />
      </mesh>

      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.7, 3.2, 48]} />
        <meshBasicMaterial color={booth.color} transparent opacity={selected ? 0.52 : 0.18} side={THREE.DoubleSide} />
      </mesh>

      {open ? (
        <mesh position={[0, 3.55, 0]}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial color="#f8fafc" emissive={booth.color} emissiveIntensity={1.4} />
        </mesh>
      ) : null}

      <Float speed={2.1} rotationIntensity={0.16} floatIntensity={0.3}>
        <mesh position={[0, 4.05, 0]}>
          <icosahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color={frameColor} emissive={booth.color} emissiveIntensity={selected ? 0.8 : 0.18} metalness={0.25} roughness={0.2} />
        </mesh>
      </Float>

      <Html position={[0, 4.9, 0]} center distanceFactor={15}>
        <div
          className={cn(
            "min-w-[170px] rounded-2xl border px-3 py-2 text-center backdrop-blur-md transition-all",
            selected
              ? "border-cyan-300/35 bg-slate-950/80 text-white shadow-[0_0_30px_rgba(34,211,238,0.22)]"
              : "border-white/10 bg-slate-950/60 text-white/70",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{open ? "active booth" : "booth"}</p>
          <p className="mt-1 text-sm font-semibold">{booth.title}</p>
          <p className="mt-1 text-xs text-white/50">{booth.subtitle}</p>
        </div>
      </Html>
    </group>
  );
}

function CameraRig({ target }: { target: [number, number, number] }) {
  const { camera } = useThree();
  const targetPosition = useMemo(() => new THREE.Vector3(target[0], 6.2, target[2] + 13.5), [target]);
  const lookAtTarget = useMemo(() => new THREE.Vector3(target[0], 2.1, target[2]), [target]);

  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-delta * 2.4);
    camera.position.lerp(targetPosition, alpha);
    camera.lookAt(lookAtTarget);
  });

  return null;
}

function OverlayPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-center text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
      <span className="text-white/40">{label}</span> {value}
    </div>
  );
}

function translateDirection(direction: AttentionDirection) {
  switch (direction) {
    case "left":
      return "left";
    case "right":
      return "right";
    case "up":
      return "forward";
    case "down":
      return "back";
    default:
      return "idle";
  }
}
