"use client";

import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { MutableRefObject } from "react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { SkyportAvatar } from "@/components/world/skyport-avatar";
import { CAMERA_DEFAULT, INITIAL_PLAYER_HEADING, PLAYER_SPAWN, WORLD_BOUNDS } from "@/components/world/world-config";
import type { CameraRigRef, KeyboardState, TrackingMode } from "@/components/world/world-types";
import { createToonGradientTexture, dampAngle, resolveNearbyDistrict } from "@/components/world/world-utils";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";

interface PlayerControllerProps {
  cameraRigRef: CameraRigRef;
  keyStateRef: MutableRefObject<KeyboardState>;
  trackingMode: TrackingMode;
}

export function PlayerController({ cameraRigRef, keyStateRef, trackingMode }: PlayerControllerProps) {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const setPlayerPosition = useSkyportWorldStore((state) => state.setPlayerPosition);
  const setPlayerHeading = useSkyportWorldStore((state) => state.setPlayerHeading);
  const setPlayerMotion = useSkyportWorldStore((state) => state.setPlayerMotion);
  const setNearDistrictId = useSkyportWorldStore((state) => state.setNearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const gradientTexture = useMemo(() => createToonGradientTexture(), []);
  const desiredVelocity = useMemo(() => new THREE.Vector3(), []);
  const smoothedVelocity = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const lastHeadingRef = useRef(INITIAL_PLAYER_HEADING);
  const lastMotionRef = useRef<"idle" | "walk" | "run">("idle");
  const lastNearDistrictRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      gradientTexture.dispose();
    };
  }, [gradientTexture]);

  useFrame((_, delta) => {
    const body = rigidBodyRef.current;
    if (!body) {
      return;
    }

    const position = body.translation();
    const currentVelocity = body.linvel();
    const outsidePlayableArea =
      Math.abs(position.x) > WORLD_BOUNDS.resetSize || Math.abs(position.z) > WORLD_BOUNDS.resetSize || position.y < -8;

    if (outsidePlayableArea) {
      body.setTranslation({ x: PLAYER_SPAWN[0], y: PLAYER_SPAWN[1], z: PLAYER_SPAWN[2] }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      setPlayerPosition(PLAYER_SPAWN);
      setPlayerHeading(INITIAL_PLAYER_HEADING);
      setNearDistrictId(null);
      lastNearDistrictRef.current = null;
      lastHeadingRef.current = INITIAL_PLAYER_HEADING;
      lastMotionRef.current = "idle";
      setPlayerMotion("idle");
      return;
    }

    const keys = keyStateRef.current;
    if (keys.cameraLeft) {
      cameraRigRef.current.yaw += delta * 1.7;
    }
    if (keys.cameraRight) {
      cameraRigRef.current.yaw -= delta * 1.7;
    }

    if (!introReady) {
      body.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
      setPlayerPosition([position.x, position.y, position.z]);
      setPlayerHeading(lastHeadingRef.current);
      if (lastMotionRef.current !== "idle") {
        lastMotionRef.current = "idle";
        setPlayerMotion("idle");
      }
      return;
    }

    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const inputZ = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const hasIntent = inputX !== 0 || inputZ !== 0;
    const walkSpeed = trackingMode === "remote" ? 4.5 : 5.1;
    const sprintSpeed = trackingMode === "remote" ? 6.4 : 7.4;
    const targetSpeed = keys.sprint ? sprintSpeed : walkSpeed;

    desiredVelocity.set(0, 0, 0);
    if (hasIntent) {
      const yaw = cameraRigRef.current.yaw;
      forward.set(Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, Math.sin(yaw));
      desiredVelocity.addScaledVector(forward, inputZ);
      desiredVelocity.addScaledVector(right, inputX);
      desiredVelocity.normalize().multiplyScalar(targetSpeed);

      const targetHeading = Math.atan2(desiredVelocity.x, desiredVelocity.z);
      lastHeadingRef.current = dampAngle(lastHeadingRef.current, targetHeading, delta, 14);
    }

    smoothedVelocity.set(currentVelocity.x, 0, currentVelocity.z);
    smoothedVelocity.lerp(desiredVelocity, 1 - Math.exp(-delta * (hasIntent ? 13 : 20)));
    body.setLinvel({ x: smoothedVelocity.x, y: currentVelocity.y, z: smoothedVelocity.z }, true);

    const nextPosition = body.translation();
    setPlayerPosition([nextPosition.x, nextPosition.y, nextPosition.z]);
    setPlayerHeading(lastHeadingRef.current);

    const nearDistrict = resolveNearbyDistrict(nextPosition.x, nextPosition.z);
    if (nearDistrict !== lastNearDistrictRef.current) {
      lastNearDistrictRef.current = nearDistrict;
      setNearDistrictId(nearDistrict);
    }

    const horizontalSpeed = smoothedVelocity.length();
    const nextMotion: "idle" | "walk" | "run" =
      horizontalSpeed < 0.2 ? "idle" : keys.sprint && horizontalSpeed > walkSpeed * 1.05 ? "run" : "walk";

    if (nextMotion !== lastMotionRef.current) {
      lastMotionRef.current = nextMotion;
      setPlayerMotion(nextMotion);
    }

    if (avatarRef.current) {
      avatarRef.current.rotation.y = dampAngle(avatarRef.current.rotation.y, lastHeadingRef.current, delta, 14);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      position={PLAYER_SPAWN}
      enabledRotations={[false, false, false]}
      linearDamping={8.5}
      angularDamping={18}
      canSleep={false}
      friction={1.2}
    >
      <CapsuleCollider args={[0.52, 0.36]} position={[0, 0.88, 0]} />
      <group ref={avatarRef}>
        <Suspense fallback={<AvatarFallback gradientTexture={gradientTexture} />}>
          <SkyportAvatar gradientTexture={gradientTexture} />
        </Suspense>
      </group>
    </RigidBody>
  );
}

function AvatarFallback({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.42, 28]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.16} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.9, 6, 12]} />
        <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 1.76, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshToonMaterial color="#f8fafc" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

export function resetCameraRig(cameraRigRef: CameraRigRef) {
  cameraRigRef.current.yaw = CAMERA_DEFAULT.yaw;
  cameraRigRef.current.pitch = CAMERA_DEFAULT.pitch;
  cameraRigRef.current.distance = CAMERA_DEFAULT.distance;
}
