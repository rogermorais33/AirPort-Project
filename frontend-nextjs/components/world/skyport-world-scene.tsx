"use client";

import { WorldCanvas } from "@/components/world/WorldCanvas";
import type { SkyportWorldSceneProps } from "@/components/world/world-types";

export function SkyportWorldScene(props: SkyportWorldSceneProps) {
  return <WorldCanvas {...props} />;
}
