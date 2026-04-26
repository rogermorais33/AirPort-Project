"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SkyportAvatarModel } from "@/components/world/skyport-avatar";
import { NPCS } from "@/components/world/world-config";
import type { NpcDefinition } from "@/components/world/world-types";
import { dampAngle, seededNoise } from "@/components/world/world-utils";

interface NPCSystemProps {
  gradientTexture: THREE.DataTexture;
}

type NpcPhase = "idle" | "walk" | "gesture";

export function NPCSystem({ gradientTexture }: NPCSystemProps) {
  return (
    <group>
      {NPCS.map((npc, index) => (
        <SkyportNpc key={npc.id} npc={npc} index={index} gradientTexture={gradientTexture} />
      ))}
    </group>
  );
}

function SkyportNpc({ npc, index, gradientTexture }: { npc: NpcDefinition; index: number; gradientTexture: THREE.DataTexture }) {
  const rootRef = useRef<THREE.Group | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const headingRef = useRef(Math.PI);
  const waypointRef = useRef(1);
  const waitUntilRef = useRef(1.2 + index * 0.4);
  const phaseRef = useRef<NpcPhase>("idle");
  const [motion, setMotion] = useState<"idle" | "walk">("idle");
  const temp = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    if (phaseRef.current !== "walk" && state.clock.elapsedTime >= waitUntilRef.current) {
      phaseRef.current = "walk";
      setMotion("walk");
    }

    if (phaseRef.current === "walk") {
      const currentTarget = npc.path[waypointRef.current];
      target.set(currentTarget[0], currentTarget[1], currentTarget[2]);
      temp.copy(target).sub(root.position);
      temp.y = 0;

      if (temp.length() < 0.28) {
        waypointRef.current = (waypointRef.current + 1) % npc.path.length;
        const waitDuration = npc.waitRange[0] + seededNoise(index + waypointRef.current * 10) * (npc.waitRange[1] - npc.waitRange[0]);
        waitUntilRef.current = state.clock.elapsedTime + waitDuration;
        phaseRef.current = seededNoise(index + waypointRef.current * 3) > 0.68 ? "gesture" : "idle";
        setMotion("idle");
      } else {
        temp.normalize();
        root.position.addScaledVector(temp, npc.speed * delta);
        headingRef.current = dampAngle(headingRef.current, Math.atan2(temp.x, temp.z), delta, 7.5);
      }
    }

    if (phaseRef.current === "gesture") {
      const gesture = Math.sin(state.clock.elapsedTime * 5 + index) * 0.08;
      headingRef.current += gesture * delta;
    }

    if (avatarRef.current) {
      avatarRef.current.rotation.y = dampAngle(avatarRef.current.rotation.y, headingRef.current, delta, 9);
      avatarRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.8 + index) * 0.012;
    }
  });

  const start = npc.path[0];

  return (
    <group ref={rootRef} position={start}>
      <group ref={avatarRef}>
        <Suspense fallback={<NpcFallback gradientTexture={gradientTexture} color={npc.palette.Purple ?? "#60a5fa"} />}>
          <SkyportAvatarModel
            gradientTexture={gradientTexture}
            motion={motion}
            palette={npc.palette}
            scale={0.82}
          />
        </Suspense>
      </group>

      <Billboard follow position={[0, 2.55, 0]}>
        <group>
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[2.6, 0.56]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Text color="#ffffff" fontSize={0.14} anchorX="center" anchorY="middle" maxWidth={2.4} position={[0, 0.09, 0]}>
            {npc.name}
          </Text>
          <Text color="#bfdbfe" fontSize={0.08} anchorX="center" anchorY="middle" maxWidth={2.4} position={[0, -0.11, 0]}>
            {npc.role}
          </Text>
        </group>
      </Billboard>
    </group>
  );
}

function NpcFallback({ gradientTexture, color }: { gradientTexture: THREE.DataTexture; color: string }) {
  return (
    <group>
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.78, 6, 10]} />
        <meshToonMaterial color={color} gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshToonMaterial color="#f8fafc" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}
