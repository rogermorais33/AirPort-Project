"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";

import {
  STATIC_WORLD_COLLIDERS,
  WORLD_BOUNDS,
  WORLD_BUILDINGS,
  WORLD_PROPS,
  WORLD_TREES,
} from "@/components/world/world-config";
import { SKYPORT_DISTRICTS } from "@/lib/world-data";

export function CollisionWorld() {
  const half = WORLD_BOUNDS.halfSize;
  const wallHeight = WORLD_BOUNDS.wallHeight;
  const treeColliders = WORLD_TREES.filter((tree) => tree.collider);

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half + 16, 0.16, half + 16]} position={[0, -0.16, 0]} friction={1.1} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half, wallHeight, 0.9]} position={[0, wallHeight, -half]} />
        <CuboidCollider args={[half, wallHeight, 0.9]} position={[0, wallHeight, half]} />
        <CuboidCollider args={[0.9, wallHeight, half]} position={[-half, wallHeight, 0]} />
        <CuboidCollider args={[0.9, wallHeight, half]} position={[half, wallHeight, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {SKYPORT_DISTRICTS.map((district) => {
          const [x, , z] = district.position;
          const [width, height, depth] = district.shellSize;
          return (
            <CuboidCollider
              key={district.id}
              args={[Math.max(3, width * 0.32), height * 0.44, Math.max(3, depth * 0.32)]}
              position={[x, Math.max(2.1, height * 0.44), z]}
              friction={1.2}
            />
          );
        })}

        {WORLD_BUILDINGS.map((building) => (
          <CuboidCollider
            key={building.id}
            args={[building.size[0] * 0.46, building.size[1] * 0.5, building.size[2] * 0.46]}
            position={[building.position[0], building.position[1] + building.size[1] * 0.5, building.position[2]]}
            rotation={[0, building.rotationY ?? 0, 0]}
            friction={1.2}
          />
        ))}

        {WORLD_PROPS.filter((prop) => prop.collider !== false).map((prop) => (
          <CuboidCollider
            key={prop.id}
            args={[prop.size[0] * 0.5, Math.max(0.22, prop.size[1] * 0.5), prop.size[2] * 0.5]}
            position={[prop.position[0], prop.position[1] + Math.max(0.22, prop.size[1] * 0.5), prop.position[2]]}
            rotation={[0, prop.rotationY ?? 0, 0]}
            friction={1.2}
          />
        ))}

        {STATIC_WORLD_COLLIDERS.map((collider) => (
          <CuboidCollider
            key={collider.id}
            args={[collider.size[0] / 2, collider.size[1] / 2, collider.size[2] / 2]}
            position={collider.position}
            rotation={[0, collider.rotationY ?? 0, 0]}
            friction={1.2}
          />
        ))}

        {treeColliders.map((tree) => (
          <CuboidCollider
            key={tree.id}
            args={[0.42 * tree.scale, 1.15 * tree.scale, 0.42 * tree.scale]}
            position={[tree.position[0], 1.15 * tree.scale, tree.position[2]]}
            friction={1.05}
          />
        ))}
      </RigidBody>
    </>
  );
}
