"use client";

import * as THREE from "three";

import { SKYPORT_DISTRICTS } from "@/lib/world-data";

export function createToonGradientTexture() {
  const data = new Uint8Array([
    28, 46, 75, 255,
    72, 112, 150, 255,
    143, 205, 236, 255,
    255, 244, 210, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function damp(current: number, target: number, delta: number, lambda: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * lambda));
}

export function dampAngle(current: number, target: number, delta: number, lambda: number) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-delta * lambda));
}

export function resolveNearbyDistrict(x: number, z: number) {
  let nearest: { id: string; distance: number } | null = null;

  for (const district of SKYPORT_DISTRICTS) {
    const dx = district.position[0] - x;
    const dz = district.position[2] - z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > district.zoneRadius) {
      continue;
    }
    if (!nearest || distance < nearest.distance) {
      nearest = { id: district.id, distance };
    }
  }

  return nearest?.id ?? null;
}

export function horizontalAngleTo(from: [number, number, number], to: [number, number, number]) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

export function seededNoise(index: number) {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
