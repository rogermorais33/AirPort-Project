"use client";

import { Float, Html, useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { computeObjectFit, applyToonLook } from "@/components/world/model-utils";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import type { WorldDistrict } from "@/lib/world-data";
import { cn } from "@/lib/utils";

interface SkyportGltfEnvironmentProps {
  gradientTexture: THREE.DataTexture;
  openDistrictId: string | null;
  districts: WorldDistrict[];
}

export function SkyportGltfEnvironment({ gradientTexture, openDistrictId, districts }: SkyportGltfEnvironmentProps) {
  return (
    <>
      <SkyportMapBase gradientTexture={gradientTexture} />
      {districts.map((district) => (
        <DistrictLandmark
          key={district.id}
          district={district}
          gradientTexture={gradientTexture}
          open={district.id === openDistrictId}
        />
      ))}
      <DistrictLightRails districts={districts} />
    </>
  );
}

function SkyportMapBase({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const { scene } = useGLTF("/models/skyport-map.glb");
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const fit = useMemo(() => computeObjectFit(clonedScene, [48, 18, 50]), [clonedScene]);

  useLayoutEffect(() => {
    applyToonLook(clonedScene, gradientTexture, {
      tint: "#8ab8ff",
      tintStrength: 0.1,
      emissive: "#8ac5ff",
      emissiveIntensity: 0.02,
    });
  }, [clonedScene, gradientTexture]);

  return (
    <group position={[0, 0.04, 0]}>
      <group scale={fit.scale} rotation-y={Math.PI / 2}>
        <primitive object={clonedScene} position={fit.groundedPosition} />
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <ringGeometry args={[6.8, 11.2, 96]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
        <ringGeometry args={[16.8, 17.1, 96]} />
        <meshBasicMaterial color="#f9a8d4" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function DistrictLandmark({
  district,
  gradientTexture,
  open,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  open: boolean;
}) {
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const selectedActionIndex = useSkyportWorldStore((state) => state.selectedActionIndex);
  const focused = nearDistrictId === district.id;
  const rotationY = Math.atan2(-district.position[0], -district.position[2]);
  const signY = district.shellSize[1] + 1.4;
  const beaconY = signY + 0.65;

  return (
    <RigidBody type="fixed" colliders={false} position={district.position}>
      <CuboidCollider
        args={[district.shellSize[0] / 2, district.shellSize[1] / 2, district.shellSize[2] / 2]}
        position={[0, district.shellSize[1] / 2, -0.2]}
      />

      <LandmarkModel
        variant={district.landmarkType}
        gradientTexture={gradientTexture}
        tint={district.color}
        accent={district.accent}
        open={open}
        footprint={[district.shellSize[0] + 1.2, district.shellSize[1] + 1.4, district.shellSize[2] + 1.2]}
        rotationY={rotationY + Math.PI}
        position={[0, 0, -0.35]}
      />

      <group rotation-y={rotationY}>
        <PortalPad district={district} gradientTexture={gradientTexture} focused={focused} open={open} />
      </group>

      {focused ? (
        <InteractionBeacon
          color={district.color}
          accent={district.accent}
          position={[0, beaconY, 0]}
          selectedActionIndex={selectedActionIndex}
          actionLabel={district.actions[selectedActionIndex]?.label ?? "Enter"}
        />
      ) : null}

      <Float speed={1.7} rotationIntensity={0.12} floatIntensity={0.24}>
        <mesh position={[0, signY + (open ? 0.38 : 0), 0]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshToonMaterial color={district.accent} gradientMap={gradientTexture} />
        </mesh>
      </Float>

      <Html position={[0, signY, 0]} center distanceFactor={13}>
        <div
          className={cn(
            "min-w-[176px] rounded-2xl border px-3 py-2 text-center backdrop-blur-md transition-all",
            focused
              ? "border-cyan-300/35 bg-slate-950/84 text-white shadow-[0_0_30px_rgba(34,211,238,0.22)]"
              : "border-white/10 bg-slate-950/60 text-white/70",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{district.signLabel}</p>
          <p className="mt-1 text-sm font-semibold">{district.title}</p>
          <p className="mt-1 text-xs text-white/50">{district.subtitle}</p>
        </div>
      </Html>
    </RigidBody>
  );
}

function LandmarkModel({
  variant,
  gradientTexture,
  tint,
  accent,
  footprint,
  rotationY,
  position,
  open,
}: {
  variant: WorldDistrict["landmarkType"];
  gradientTexture: THREE.DataTexture;
  tint: string;
  accent: string;
  footprint: [number, number, number];
  rotationY: number;
  position: [number, number, number];
  open: boolean;
}) {
  const path = variant === "market" ? "/models/skyport-market.glb" : "/models/skyport-apartments.glb";
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const fit = useMemo(() => computeObjectFit(clonedScene, footprint), [clonedScene, footprint]);

  useLayoutEffect(() => {
    applyToonLook(clonedScene, gradientTexture, {
      tint,
      tintStrength: 0.14,
      emissive: accent,
      emissiveIntensity: open ? 0.09 : 0.04,
    });
  }, [accent, clonedScene, gradientTexture, open, tint]);

  return (
    <group position={position} rotation-y={rotationY} scale={fit.scale}>
      <primitive object={clonedScene} position={fit.groundedPosition} />
    </group>
  );
}

function PortalPad({
  district,
  gradientTexture,
  focused,
  open,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  focused: boolean;
  open: boolean;
}) {
  const glow = open ? 0.92 : focused ? 0.7 : 0.36;

  return (
    <group>
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[district.shellSize[0] * 0.45, district.shellSize[0] * 0.5, 0.26, 48]} />
        <meshToonMaterial color="#101a34" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[district.zoneRadius - 0.28, district.zoneRadius, 64]} />
        <meshBasicMaterial color={district.color} transparent opacity={focused ? 0.36 : 0.12} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 1.85, district.shellSize[2] * 0.46]} castShadow>
        <torusGeometry args={[1.06, 0.08, 18, 56]} />
        <meshBasicMaterial color={district.color} transparent opacity={glow} />
      </mesh>

      <mesh position={[0, 1.85, district.shellSize[2] * 0.46]}>
        <planeGeometry args={[1.32, 2.4]} />
        <meshBasicMaterial color={district.accent} transparent opacity={glow * 0.3} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 1.86, district.shellSize[2] * 0.2]} castShadow>
        <boxGeometry args={[2.4, 3.4, 0.28]} />
        <meshToonMaterial color="#172554" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 1.86, district.shellSize[2] * 0.34]}>
        <boxGeometry args={[1.44, 2.4, 0.18]} />
        <meshBasicMaterial color={district.color} transparent opacity={glow * 0.5} />
      </mesh>
    </group>
  );
}

function InteractionBeacon({
  position,
  color,
  accent,
  selectedActionIndex,
  actionLabel,
}: {
  position: [number, number, number];
  color: string;
  accent: string;
  selectedActionIndex: number;
  actionLabel: string;
}) {
  const ringRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3.4) * 0.08);
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.9, 0.06, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Html position={[0, 1.05, 0]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-md">
          slot 0{selectedActionIndex + 1} {actionLabel}
        </div>
      </Html>
    </group>
  );
}

function DistrictLightRails({ districts }: { districts: WorldDistrict[] }) {
  return (
    <>
      {districts.map((district) => (
        <mesh key={district.id} position={[district.position[0], 0.26, district.position[2]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[district.zoneRadius + 0.38, district.zoneRadius + 0.6, 48]} />
          <meshBasicMaterial color={district.accent} transparent opacity={0.06} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}
