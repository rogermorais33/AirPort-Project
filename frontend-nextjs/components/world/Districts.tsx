"use client";

import { Float, Sparkles } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { DistrictBeacon } from "@/components/world/Interactables";
import { applyToonLook, computeObjectFit } from "@/components/world/model-utils";
import { DISTRICT_SCENE_CONFIG } from "@/components/world/world-config";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import { SKYPORT_DISTRICTS, type WorldDistrict } from "@/lib/world-data";

interface DistrictsProps {
  gradientTexture: THREE.DataTexture;
  openDistrictId: string | null;
  onSelectDistrict: (districtId: string) => void;
}

export function Districts({ gradientTexture, openDistrictId, onSelectDistrict }: DistrictsProps) {
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);

  return (
    <group>
      {SKYPORT_DISTRICTS.map((district) => {
        const config = DISTRICT_SCENE_CONFIG[district.id];
        const active = openDistrictId === district.id;
        const nearby = nearDistrictId === district.id;

        return (
          <group key={district.id}>
            <DistrictHub
              district={district}
              gradientTexture={gradientTexture}
              active={active}
              nearby={nearby}
            />
            <DistrictBeacon
              district={district}
              config={config}
              active={active}
              nearby={nearby}
              onSelect={onSelectDistrict}
            />
          </group>
        );
      })}
    </group>
  );
}

function DistrictHub({
  district,
  gradientTexture,
  active,
  nearby,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  active: boolean;
  nearby: boolean;
}) {
  const config = DISTRICT_SCENE_CONFIG[district.id];
  const [x, y, z] = district.position;
  const headingToCenter = Math.atan2(-x, -z);

  return (
    <group position={[x, y, z]} rotation-y={headingToCenter}>
      <mesh receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[config.platformRadius, config.platformRadius + 0.45, 0.24, 8]} />
        <meshToonMaterial color={district.color} gradientMap={gradientTexture} />
      </mesh>

      <mesh receiveShadow position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[config.platformRadius - 1.2, config.platformRadius - 0.92, 8]} />
        <meshBasicMaterial color={district.accent} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group position={[0, 0, -0.2]}>
        <Suspense fallback={<DistrictFallbackBuilding district={district} gradientTexture={gradientTexture} />}>
          <DistrictLandmarkModel district={district} gradientTexture={gradientTexture} />
        </Suspense>
      </group>

      <DistrictAccentArchitecture district={district} gradientTexture={gradientTexture} active={active} nearby={nearby} />

      <Sparkles
        count={active || nearby ? 34 : 14}
        scale={[config.platformRadius * 1.8, 3.4, config.platformRadius * 1.8]}
        position={[0, 2.4, 0]}
        size={active ? 2.4 : 1.5}
        speed={active ? 0.28 : 0.12}
        color={district.accent}
      />
    </group>
  );
}

function DistrictLandmarkModel({ district, gradientTexture }: { district: WorldDistrict; gradientTexture: THREE.DataTexture }) {
  const { scene } = useGLTF(district.landmarkModelPath);
  const object = useMemo(() => scene.clone(true), [scene]);
  const targetSize = useMemo(
    () => [district.shellSize[0] * 0.72, district.shellSize[1] * 0.82, district.shellSize[2] * 0.72] as [number, number, number],
    [district.shellSize],
  );
  const fit = useMemo(() => computeObjectFit(object, targetSize), [object, targetSize]);

  useLayoutEffect(() => {
    applyToonLook(object, gradientTexture, {
      tint: district.color,
      tintStrength: 0.1,
      emissive: district.color,
      emissiveIntensity: 0.035,
    });
  }, [district.color, gradientTexture, object]);

  return (
    <group scale={fit.scale} position={fit.groundedPosition.toArray()} rotation-y={Math.PI}>
      <primitive object={object} />
    </group>
  );
}

function DistrictFallbackBuilding({ district, gradientTexture }: { district: WorldDistrict; gradientTexture: THREE.DataTexture }) {
  const height = district.shellSize[1] * 0.48;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[district.shellSize[0] * 0.42, height, district.shellSize[2] * 0.42]} />
        <meshToonMaterial color={district.color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, height + 0.45, 0]} castShadow>
        <coneGeometry args={[district.shellSize[0] * 0.33, 0.9, 4]} />
        <meshToonMaterial color={district.accent} gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

function DistrictAccentArchitecture({
  district,
  gradientTexture,
  active,
  nearby,
}: {
  district: WorldDistrict;
  gradientTexture: THREE.DataTexture;
  active: boolean;
  nearby: boolean;
}) {
  const config = DISTRICT_SCENE_CONFIG[district.id];
  const opacity = active ? 0.76 : nearby ? 0.58 : 0.34;

  return (
    <group>
      <Float speed={0.9} rotationIntensity={0.1} floatIntensity={0.16}>
        <mesh position={[0, config.beaconHeight * 0.62, -2.8]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[config.ringRadius * 0.48, 0.035, 8, 64]} />
          <meshBasicMaterial color={district.accent} transparent opacity={opacity} />
        </mesh>
      </Float>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * (config.platformRadius - 1.1), 0, 1.7]}>
          <mesh position={[0, 1.25, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 2.5, 6]} />
            <meshToonMaterial color="#1e293b" gradientMap={gradientTexture} />
          </mesh>
          <mesh position={[0, 2.65, 0]} castShadow>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshBasicMaterial color={district.accent} transparent opacity={0.88} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

for (const district of SKYPORT_DISTRICTS) {
  useGLTF.preload(district.landmarkModelPath);
}
