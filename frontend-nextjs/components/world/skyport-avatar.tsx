"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { applyToonLook, computeObjectFit } from "@/components/world/model-utils";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";

export function SkyportAvatar({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const motion = useSkyportWorldStore((state) => state.playerMotion);
  const { scene, animations } = useGLTF("/models/avatar.glb");
  const clonedScene = useMemo(() => clone(scene), [scene]);
  const fit = useMemo(() => computeObjectFit(clonedScene, [1.4, 2.9, 1.4]), [clonedScene]);
  const rootRef = useRef<THREE.Group | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const { actions } = useAnimations(animations, rootRef);

  useLayoutEffect(() => {
    applyToonLook(clonedScene, gradientTexture, {
      tint: "#6aa8ff",
      tintStrength: 0.08,
      emissive: "#7dd3fc",
      emissiveIntensity: 0.02,
    });
  }, [clonedScene, gradientTexture]);

  useEffect(() => {
    const clip = resolveMotionAction(actions, motion);
    if (!clip || activeActionRef.current === clip) {
      return;
    }

    clip.reset().fadeIn(0.22).play();
    clip.timeScale = motion === "run" ? 1.18 : motion === "walk" ? 1 : 0.92;

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.2);
    }

    activeActionRef.current = clip;
  }, [actions, motion]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (haloRef.current) {
      haloRef.current.rotation.z += 0.014;
      haloRef.current.scale.setScalar(1 + Math.sin(t * 2.8) * 0.05);
    }
  });

  return (
    <group ref={rootRef}>
      <group scale={fit.scale} position={fit.groundedPosition} rotation-y={Math.PI}>
        <primitive object={clonedScene} />
      </group>

      <mesh ref={haloRef} position={[0, 2.92, 0]}>
        <torusGeometry args={[0.34, 0.035, 10, 44]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

function resolveMotionAction(
  actions: Partial<Record<string, THREE.AnimationAction | null>>,
  motion: "idle" | "walk" | "run",
) {
  const candidates =
    motion === "run"
      ? ["CharacterArmature|Run", "Run", "Rig|Sprint_Loop", "Rig|Jog_Fwd_Loop"]
      : motion === "walk"
        ? ["CharacterArmature|Walk", "Walk", "Rig|Walk_Loop", "Rig|Walk_Formal_Loop"]
        : ["CharacterArmature|Idle", "CharacterArmature|Idle_Neutral", "Idle", "Rig|Idle_Loop"];

  for (const candidate of candidates) {
    if (actions[candidate]) {
      return actions[candidate];
    }
  }

  return Object.values(actions).find(Boolean) ?? null;
}
