"use client";

import type { MutableRefObject } from "react";

export type TrackingMode = "off" | "remote" | "local";
export type PlayerMotion = "idle" | "walk" | "run";
export type Vec3Tuple = [number, number, number];

export interface SkyportWorldSceneProps {
  trackingMode: TrackingMode;
  blinkPulse: number;
  motionLatencyMs: number | null;
  openDistrictId: string | null;
  onEnterDistrict: (payload: {
    districtId: string;
    source: "blink" | "keyboard" | "click";
  }) => void;
}

export interface KeyboardState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  cameraLeft: boolean;
  cameraRight: boolean;
}

export interface CameraRigState {
  yaw: number;
  pitch: number;
  distance: number;
}

export type CameraRigRef = MutableRefObject<CameraRigState>;

export interface DistrictSceneConfig {
  id: string;
  theme: string;
  label: string;
  kind: "dock" | "tower" | "theater" | "arcade" | "cafe" | "lab";
  platformRadius: number;
  beaconHeight: number;
  ringRadius: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  path: Vec3Tuple[];
  speed: number;
  palette: Record<string, string>;
  waitRange: [number, number];
}

export interface StaticColliderConfig {
  id: string;
  position: Vec3Tuple;
  size: Vec3Tuple;
  rotationY?: number;
}

export interface WorldBuildingDefinition {
  id: string;
  position: Vec3Tuple;
  size: Vec3Tuple;
  color: string;
  accent?: string;
  rotationY?: number;
  modelPath?: string;
  roof?: "flat" | "beacon" | "garden" | "radar" | "antenna";
}

export interface WorldPropDefinition {
  id: string;
  kind: "cargo" | "terminal" | "gate" | "rock" | "antenna" | "sign" | "platform" | "hangar";
  position: Vec3Tuple;
  size: Vec3Tuple;
  color: string;
  accent?: string;
  rotationY?: number;
  collider?: boolean;
}

export interface WorldTreeDefinition {
  id: string;
  position: Vec3Tuple;
  scale: number;
  variant: "pine" | "broadleaf" | "palm";
  collider?: boolean;
}

export interface WorldLampDefinition {
  id: string;
  position: Vec3Tuple;
  height?: number;
  color?: string;
}
