"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import type { CameraRigRef, TrackingMode } from "@/components/world/world-types";
import { CAMERA_LIMITS } from "@/components/world/world-config";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";

interface ThirdPersonCameraProps {
  cameraRigRef: CameraRigRef;
  trackingMode: TrackingMode;
}

export function ThirdPersonCamera({ cameraRigRef, trackingMode }: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const playerPosition = useSkyportWorldStore((state) => state.playerPosition);
  const playerHeading = useSkyportWorldStore((state) => state.playerHeading);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredCamera = useMemo(() => new THREE.Vector3(8, 7, 18), []);
  const lookAt = useMemo(() => new THREE.Vector3(0, 1.4, 8), []);
  const smoothedLookAt = useMemo(() => new THREE.Vector3(0, 1.4, 8), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const headingLead = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const rig = cameraRigRef.current;
    const yaw = rig.yaw;
    const pitch = THREE.MathUtils.clamp(rig.pitch, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch);
    const distance = THREE.MathUtils.clamp(rig.distance, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
    forward.set(Math.sin(yaw), 0, -Math.cos(yaw));
    const horizontalDistance = Math.cos(pitch) * distance;
    const height = 1.8 + Math.sin(pitch) * distance;

    targetPosition.set(playerPosition[0], Math.max(0, playerPosition[1]), playerPosition[2]);

    if (!introReady) {
      desiredCamera.set(22, 18, 30);
      lookAt.set(0, 1.8, 8);
    } else {
      const cameraLag = trackingMode === "remote" ? 3.8 : 5.4;
      desiredCamera.copy(targetPosition).addScaledVector(forward, -horizontalDistance);
      desiredCamera.y += height;
      desiredCamera.y = Math.max(desiredCamera.y, 3.2);

      const leadDistance = trackingMode === "remote" ? 0.15 : 0.25;
      headingLead.set(Math.sin(playerHeading), 0, Math.cos(playerHeading));
      lookAt
        .copy(targetPosition)
        .addScaledVector(headingLead, leadDistance);
      lookAt.y += 0.88;

      camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * cameraLag));
      smoothedLookAt.lerp(lookAt, 1 - Math.exp(-delta * 8.4));
      camera.lookAt(smoothedLookAt);
      return;
    }

    camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 1.8));
    smoothedLookAt.lerp(lookAt, 1 - Math.exp(-delta * 3.2));
    camera.lookAt(smoothedLookAt);
  });

  return null;
}
