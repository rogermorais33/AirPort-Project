"use client";

import { Billboard, Float, Sparkles, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { DistrictSceneConfig } from "@/components/world/world-types";
import type { WorldDistrict } from "@/lib/world-data";

interface DistrictBeaconProps {
  district: WorldDistrict;
  config: DistrictSceneConfig;
  active: boolean;
  nearby: boolean;
  onSelect: (districtId: string) => void;
}

export function DistrictBeacon({ district, config, active, nearby, onSelect }: DistrictBeaconProps) {
  const ringRef = useRef<THREE.Group | null>(null);
  const pulseRef = useRef<THREE.Mesh | null>(null);
  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * (active ? 1.2 : nearby ? 0.8 : 0.42);
      ringRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
    }
    if (pulseRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.3) * (active || nearby ? 0.12 : 0.05);
      pulseRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[district.position[0], 0.12, district.position[2]]}>
      <group ref={ringRef} position={[0, 0.08, 0]}>
        <mesh rotation-x={-Math.PI / 2} ref={pulseRef}>
          <ringGeometry args={[config.platformRadius + 0.16, config.platformRadius + 0.42, 64]} />
          <meshBasicMaterial
            color={district.color}
            transparent
            opacity={active ? 0.72 : nearby ? 0.5 : 0.24}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <ringGeometry args={[config.ringRadius, config.ringRadius + 0.06, 64]} />
          <meshBasicMaterial color={district.accent} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>

      <Float speed={0.72} rotationIntensity={0.12} floatIntensity={0.22}>
        <group position={[0, config.beaconHeight, 0]}>
          <mesh>
            <octahedronGeometry args={[0.64, 1]} />
            <meshBasicMaterial color={district.accent} transparent opacity={0.92} />
          </mesh>
          <mesh scale={1.55}>
            <octahedronGeometry args={[0.64, 1]} />
            <meshBasicMaterial color={district.color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      </Float>

      {(nearby || active) && (
        <Sparkles count={22} scale={[7, 3, 7]} position={[0, 2.6, 0]} size={2.1} speed={0.24} color={district.accent} />
      )}

      <Billboard follow position={[0, config.beaconHeight + 1.6, 0]}>
        <group onClick={() => onSelect(district.id)} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[5.5, 1.28]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.62} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Text
            color="#ffffff"
            fontSize={0.28}
            anchorX="center"
            anchorY="middle"
            maxWidth={5}
            textAlign="center"
            position={[0, 0.22, 0]}
          >
            {district.title}
          </Text>
          <Text
            color={district.accent}
            fontSize={0.14}
            anchorX="center"
            anchorY="middle"
            maxWidth={5}
            textAlign="center"
            position={[0, -0.2, 0]}
          >
            {nearby ? "ENTER / BLINK" : config.label.toUpperCase()}
          </Text>
        </group>
      </Billboard>
    </group>
  );
}
