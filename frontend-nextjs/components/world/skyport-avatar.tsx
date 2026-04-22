"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import { computeObjectFit } from "@/components/world/model-utils";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";

const PLAYER_PATH = "/models/kenney-characters/character-e.glb";
const PLAYER_FIT: [number, number, number] = [0.96, 1.88, 0.96];
const PLAYER_YAW_OFFSET = 0;

useGLTF.preload(PLAYER_PATH);

export function SkyportAvatar({ gradientTexture: _gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const motion = useSkyportWorldStore((state) => state.playerMotion);
  const { scene, animations } = useGLTF(PLAYER_PATH);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const fit = useMemo(() => computeObjectFit(clonedScene, PLAYER_FIT), [clonedScene]);
  const rootRef = useRef<THREE.Group | null>(null);
  const { actions } = useAnimations(animations, clonedScene);
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const hasAnimations = animations.length > 0;

  const actionMap = useMemo(() => {
    const entries = Object.entries(actions ?? {});
    const resolved: { idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; run?: THREE.AnimationAction } = {};

    const pickByPriority = (candidates: string[]) => {
      for (const candidate of candidates) {
        const exact = entries.find(([name, action]) => Boolean(action) && name.toLowerCase() === candidate);
        if (exact?.[1]) {
          return exact[1];
        }
      }
      for (const candidate of candidates) {
        const partial = entries.find(([name, action]) => Boolean(action) && name.toLowerCase().includes(candidate));
        if (partial?.[1]) {
          return partial[1];
        }
      }
      return undefined;
    };

    resolved.idle = pickByPriority(["characterarmature|idle_neutral", "characterarmature|idle", "idle"]);
    resolved.walk = pickByPriority(["characterarmature|walk", "walk"]);
    resolved.run = pickByPriority(["characterarmature|run", "sprint", "run", "jog"]);

    for (const [name, action] of entries) {
      if (!action) {
        continue;
      }

      const lower = name.toLowerCase();
      if (!resolved.idle && (lower.includes("idle") || lower.includes("neutral"))) {
        resolved.idle = action;
      }
      if (!resolved.walk && lower.includes("walk") && !lower.includes("back")) {
        resolved.walk = action;
      }
      if (
        !resolved.run &&
        (lower.includes("run") || lower.includes("jog") || lower.includes("sprint")) &&
        !lower.includes("back") &&
        !lower.includes("left") &&
        !lower.includes("right") &&
        !lower.includes("shoot")
      ) {
        resolved.run = action;
      }
    }

    if (!resolved.idle) {
      const firstAction = entries.find(([, action]) => Boolean(action))?.[1];
      if (firstAction) {
        resolved.idle = firstAction;
      }
    }

    return resolved;
  }, [actions]);

  useLayoutEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
  }, [clonedScene]);

  useEffect(() => {
    if (!hasAnimations) {
      return;
    }

    const nextAction =
      motion === "run"
        ? actionMap.run ?? actionMap.walk ?? actionMap.idle
        : motion === "walk"
          ? actionMap.walk ?? actionMap.idle
          : actionMap.idle;

    if (!nextAction || activeActionRef.current === nextAction) {
      return;
    }

    nextAction.reset().fadeIn(0.16).play();
    nextAction.timeScale = motion === "run" ? 1.15 : motion === "walk" ? 1 : 0.92;

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.16);
    }
    activeActionRef.current = nextAction;
  }, [actionMap.idle, actionMap.run, actionMap.walk, hasAnimations, motion]);

  useFrame((state) => {
    if (!rootRef.current || hasAnimations) {
      return;
    }

    const t = state.clock.elapsedTime;
    const bobStrength = motion === "idle" ? 0.01 : motion === "walk" ? 0.025 : 0.04;
    const bobSpeed = motion === "idle" ? 1.8 : motion === "walk" ? 5.8 : 7.6;

    rootRef.current.position.y = Math.sin(t * bobSpeed) * bobStrength;
    rootRef.current.rotation.x = motion === "idle" ? 0 : motion === "walk" ? -0.03 : -0.06;
  });

  return (
    <group ref={rootRef}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.44, 28]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.16} />
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} renderOrder={-1}>
        <ringGeometry args={[0.6, 0.74, 36]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.52} side={THREE.DoubleSide} />
      </mesh>

      <group scale={fit.scale} position={fit.groundedPosition} rotation-y={PLAYER_YAW_OFFSET}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
