"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";

import { STATIC_WORLD_COLLIDERS, WORLD_BOUNDS } from "@/components/world/world-config";
import { SKYPORT_DISTRICTS } from "@/lib/world-data";

export function CollisionWorld() {
  const half = WORLD_BOUNDS.halfSize;
  const wallHeight = WORLD_BOUNDS.wallHeight;

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half + 12, 0.12, half + 12]} position={[0, -0.12, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half, wallHeight, 0.7]} position={[0, wallHeight, -half]} />
        <CuboidCollider args={[half, wallHeight, 0.7]} position={[0, wallHeight, half]} />
        <CuboidCollider args={[0.7, wallHeight, half]} position={[-half, wallHeight, 0]} />
        <CuboidCollider args={[0.7, wallHeight, half]} position={[half, wallHeight, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {SKYPORT_DISTRICTS.map((district) => {
          const [x, , z] = district.position;
          const [width, height, depth] = district.shellSize;
          return (
            <CuboidCollider
              key={district.id}
              args={[Math.max(2.1, width * 0.31), height * 0.42, Math.max(2.1, depth * 0.31)]}
              position={[x, Math.max(1.5, height * 0.42), z]}
            />
          );
        })}

        {STATIC_WORLD_COLLIDERS.map((collider) => (
          <CuboidCollider
            key={collider.id}
            args={[collider.size[0] / 2, collider.size[1] / 2, collider.size[2] / 2]}
            position={collider.position}
          />
        ))}
      </RigidBody>
    </>
  );
}
