"use client";

import { Float, Html, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { AttentionDirection } from "@/lib/gaze";
import { cn } from "@/lib/utils";

import type { ExpoBooth } from "@/components/gazepilot/world-expo-scene";

interface WorldFreeRoamSceneProps {
  booths: ExpoBooth[];
  attentionDirection: AttentionDirection;
  attentionIntensity: number;
  trackingMode: "remote" | "local";
  motionLatencyMs: number | null;
  focusBoothId: string | null;
  openBoothId: string | null;
  interactionPulse: number;
  onFocusChange: (boothId: string | null) => void;
  onInteract: (boothId: string) => void;
}

interface KeyboardState {
  left: boolean;
  right: boolean;
  forward: boolean;
  back: boolean;
}

interface PlayerState {
  x: number;
  z: number;
  heading: number;
}

export function WorldFreeRoamScene({
  booths,
  attentionDirection,
  attentionIntensity,
  trackingMode,
  motionLatencyMs,
  focusBoothId,
  openBoothId,
  interactionPulse,
  onFocusChange,
  onInteract,
}: WorldFreeRoamSceneProps) {
  const keyboardRef = useRef<KeyboardState>({
    left: false,
    right: false,
    forward: false,
    back: false,
  });
  const interactionRef = useRef(interactionPulse);
  const focusedRef = useRef<string | null>(focusBoothId);

  useEffect(() => {
    function setKey(event: KeyboardEvent, value: boolean) {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        keyboardRef.current.left = value;
      } else if (key === "arrowright" || key === "d") {
        keyboardRef.current.right = value;
      } else if (key === "arrowup" || key === "w") {
        keyboardRef.current.forward = value;
      } else if (key === "arrowdown" || key === "s") {
        keyboardRef.current.back = value;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      setKey(event, true);
      if ((event.key === "Enter" || event.key === " ") && focusedRef.current) {
        onInteract(focusedRef.current);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      setKey(event, false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onInteract]);

  useEffect(() => {
    focusedRef.current = focusBoothId;
  }, [focusBoothId]);

  useEffect(() => {
    if (interactionPulse <= interactionRef.current) {
      return;
    }
    interactionRef.current = interactionPulse;
    if (focusedRef.current) {
      onInteract(focusedRef.current);
    }
  }, [interactionPulse, onInteract]);

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(10,12,32,0.93))] shadow-[0_30px_90px_rgba(2,6,23,0.5)]">
      <Canvas camera={{ position: [0, 1.7, 14], fov: 68 }} shadows dpr={[1, 1.5]}>
        <FreeRoamContent booths={booths} focusBoothId={focusBoothId} openBoothId={openBoothId} />
        <FreeRoamCameraRig
          booths={booths}
          keyboardRef={keyboardRef}
          trackingMode={trackingMode}
          attentionDirection={attentionDirection}
          attentionIntensity={attentionIntensity}
          onFocusChange={(boothId) => {
            focusedRef.current = boothId;
            onFocusChange(boothId);
          }}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <OverlayPill label="World" value="free roam" />
        <OverlayPill label="Input" value={trackingMode === "local" ? "browser cam" : "esp32"} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 grid gap-2 p-4 md:grid-cols-4">
        <OverlayPill label="Steer" value={translateDirection(attentionDirection)} />
        <OverlayPill label="Focus" value={focusBoothId ? focusBoothId.replace(/-/g, " ") : "walk the lane"} />
        <OverlayPill label="Interact" value="blink or enter" />
        <OverlayPill
          label="Motion"
          value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`}
        />
      </div>
    </div>
  );
}

function FreeRoamContent({
  booths,
  focusBoothId,
  openBoothId,
}: {
  booths: ExpoBooth[];
  focusBoothId: string | null;
  openBoothId: string | null;
}) {
  const promenadeColumns = useMemo(() => [-12, -6, 0, 6, 12], []);

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 15, 55]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight intensity={0.7} color="#dbeafe" groundColor="#030712" />
      <directionalLight
        castShadow
        intensity={2.5}
        position={[6, 18, 8]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight intensity={70} color="#22d3ee" position={[0, 7, 0]} distance={42} />
      <pointLight intensity={48} color="#f472b6" position={[0, 6, -10]} distance={26} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#06111f" roughness={0.96} metalness={0.08} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <planeGeometry args={[12, 38]} />
        <meshStandardMaterial color="#0d172b" roughness={0.78} metalness={0.18} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]}>
        <planeGeometry args={[0.35, 38]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.38} />
      </mesh>

      {promenadeColumns.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
            <planeGeometry args={[0.18, 38]} />
            <meshBasicMaterial color="#1d4ed8" transparent opacity={0.22} />
          </mesh>
        </group>
      ))}

      <QuantumHub />

      {booths.map((booth) => (
        <DistrictStructure
          key={booth.id}
          booth={booth}
          focused={booth.id === focusBoothId}
          open={booth.id === openBoothId}
        />
      ))}

      <Sparkles count={140} scale={[38, 14, 42]} position={[0, 6, -2]} size={2.2} speed={0.25} color="#67e8f9" />
    </>
  );
}

function QuantumHub() {
  return (
    <group position={[0, 0, 0]}>
      <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.25}>
        <mesh position={[0, 2.8, 0]}>
          <torusGeometry args={[1.8, 0.12, 18, 72]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.2} />
        </mesh>
      </Float>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[2.4, 2.7, 0.18, 48]} />
        <meshStandardMaterial color="#0b1120" emissive="#0ea5e9" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.8, 1.1, 1.8, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.56} roughness={0.28} />
      </mesh>
      <Html position={[0, 4.7, 0]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-white/75 backdrop-blur-md">
          Quantum Hub
        </div>
      </Html>
    </group>
  );
}

function DistrictStructure({
  booth,
  focused,
  open,
}: {
  booth: ExpoBooth;
  focused: boolean;
  open: boolean;
}) {
  const glow = new THREE.Color(booth.color);
  const emissive = focused ? booth.color : "#111827";
  const canopyHeight = open ? 4.6 : 4.15;

  return (
    <group position={booth.position}>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[2.7, 3.1, 0.28, 48]} />
        <meshStandardMaterial color="#0b1328" metalness={0.45} roughness={0.28} />
      </mesh>

      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[4.6, 2.8, 4.6]} />
        <meshStandardMaterial color="#0f172a" metalness={0.34} roughness={0.36} />
      </mesh>

      <mesh position={[0, canopyHeight, 0]} castShadow>
        <cylinderGeometry args={[2.8, 3.2, 0.22, 48]} />
        <meshStandardMaterial color="#111827" emissive={emissive} emissiveIntensity={focused ? 0.52 : 0.05} />
      </mesh>

      <mesh position={[0, 1.78, 2.32]} castShadow>
        <boxGeometry args={[3.2, 1.7, 0.14]} />
        <meshStandardMaterial color="#0b1020" emissive={booth.color} emissiveIntensity={focused ? 0.78 : 0.2} />
      </mesh>

      <mesh position={[0, 1.78, 2.42]}>
        <planeGeometry args={[2.8, 1.24]} />
        <meshBasicMaterial color={booth.color} transparent opacity={focused ? 0.42 : 0.2} />
      </mesh>

      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.3, 3.8, 60]} />
        <meshBasicMaterial color={booth.color} transparent opacity={focused ? 0.52 : 0.12} side={THREE.DoubleSide} />
      </mesh>

      {focused ? (
        <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[4.1, 4.45, 60]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      <Float speed={2.1} rotationIntensity={0.18} floatIntensity={0.35}>
        <mesh position={[0, open ? 5.2 : 4.85, 0]}>
          <icosahedronGeometry args={[0.44, 0]} />
          <meshStandardMaterial
            color={focused ? glow.clone().lerp(new THREE.Color("#ffffff"), 0.2) : "#172554"}
            emissive={booth.color}
            emissiveIntensity={focused ? 1 : 0.18}
            metalness={0.26}
            roughness={0.22}
          />
        </mesh>
      </Float>

      <Html position={[0, 6.1, 0]} center distanceFactor={14}>
        <div
          className={cn(
            "min-w-[176px] rounded-2xl border px-3 py-2 text-center backdrop-blur-md transition-all",
            focused
              ? "border-cyan-300/35 bg-slate-950/80 text-white shadow-[0_0_30px_rgba(34,211,238,0.22)]"
              : "border-white/10 bg-slate-950/60 text-white/70",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{open ? "active district" : "district"}</p>
          <p className="mt-1 text-sm font-semibold">{booth.title}</p>
          <p className="mt-1 text-xs text-white/50">{booth.subtitle}</p>
        </div>
      </Html>
    </group>
  );
}

function FreeRoamCameraRig({
  booths,
  keyboardRef,
  trackingMode,
  attentionDirection,
  attentionIntensity,
  onFocusChange,
}: {
  booths: ExpoBooth[];
  keyboardRef: MutableRefObject<KeyboardState>;
  trackingMode: "remote" | "local";
  attentionDirection: AttentionDirection;
  attentionIntensity: number;
  onFocusChange: (boothId: string | null) => void;
}) {
  const { camera } = useThree();
  const playerRef = useRef<PlayerState>({
    x: 0,
    z: 14,
    heading: Math.PI,
  });
  const currentFocusRef = useRef<string | null>(null);
  const lookVector = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const player = playerRef.current;
    const keyboard = keyboardRef.current;
    const strength = attentionDirection === "center" ? 0 : Math.max(attentionIntensity, 0.35);
    const inputSpeed = trackingMode === "local" ? 5.4 : 2.8;
    const turnSpeed = trackingMode === "local" ? 1.7 : 1.02;

    let turnIntent = 0;
    if (keyboard.left) {
      turnIntent -= 1;
    }
    if (keyboard.right) {
      turnIntent += 1;
    }
    if (attentionDirection === "left") {
      turnIntent -= strength;
    }
    if (attentionDirection === "right") {
      turnIntent += strength;
    }

    let throttleIntent = 0;
    if (keyboard.forward) {
      throttleIntent += 1;
    }
    if (keyboard.back) {
      throttleIntent -= 1;
    }
    if (attentionDirection === "up") {
      throttleIntent += strength;
    }
    if (attentionDirection === "down") {
      throttleIntent -= strength;
    }

    player.heading += turnIntent * delta * turnSpeed;
    const distance = throttleIntent * delta * inputSpeed;
    player.x += Math.sin(player.heading) * distance;
    player.z += Math.cos(player.heading) * distance;
    player.x = THREE.MathUtils.clamp(player.x, -18, 18);
    player.z = THREE.MathUtils.clamp(player.z, -18, 18);

    cameraTarget.set(player.x, 1.7, player.z);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 7));
    lookVector.set(player.x + Math.sin(player.heading) * 5.2, 1.8, player.z + Math.cos(player.heading) * 5.2);
    camera.lookAt(lookVector);

    const focusedBooth = findFocusedBooth(booths, player);
    if (focusedBooth?.id !== currentFocusRef.current) {
      currentFocusRef.current = focusedBooth?.id ?? null;
      onFocusChange(focusedBooth?.id ?? null);
    }
  });

  return null;
}

function findFocusedBooth(booths: ExpoBooth[], player: PlayerState) {
  let best: { booth: ExpoBooth; score: number } | null = null;

  for (const booth of booths) {
    const dx = booth.position[0] - player.x;
    const dz = booth.position[2] - player.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > 10.5) {
      continue;
    }

    const angleToBooth = Math.atan2(dx, dz);
    const deltaAngle = normalizeAngle(angleToBooth - player.heading);
    const absAngle = Math.abs(deltaAngle);
    if (absAngle > 0.72) {
      continue;
    }

    const score = distance + absAngle * 4.8;
    if (!best || score < best.score) {
      best = { booth, score };
    }
  }

  return best?.booth ?? null;
}

function normalizeAngle(value: number) {
  let angle = value;
  while (angle > Math.PI) {
    angle -= Math.PI * 2;
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2;
  }
  return angle;
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
      return "turn left";
    case "right":
      return "turn right";
    case "up":
      return "forward";
    case "down":
      return "back";
    default:
      return "idle";
  }
}
