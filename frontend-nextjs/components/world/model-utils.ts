"use client";

import * as THREE from "three";

export function computeObjectFit(object: THREE.Object3D, targetSize: [number, number, number]) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const safeSize = new THREE.Vector3(
    Math.max(size.x, 0.001),
    Math.max(size.y, 0.001),
    Math.max(size.z, 0.001),
  );

  const scale = Math.min(targetSize[0] / safeSize.x, targetSize[1] / safeSize.y, targetSize[2] / safeSize.z);

  return {
    box,
    size,
    center,
    scale,
    groundedPosition: new THREE.Vector3(-center.x, -box.min.y, -center.z),
  };
}

export function applyToonLook(
  object: THREE.Object3D,
  gradientTexture: THREE.Texture,
  options?: {
    tint?: string;
    tintStrength?: number;
    emissive?: string;
    emissiveIntensity?: number;
  },
) {
  const tintColor = options?.tint ? new THREE.Color(options.tint) : null;
  const emissiveColor = new THREE.Color(options?.emissive ?? "#000000");
  const tintStrength = options?.tintStrength ?? 0.12;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;

    if (child.userData.gazepilotToonized) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const toonMaterials = materials.map((material) => {
      const source = material as THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshBasicMaterial;
      const baseColor =
        "color" in source && source.color instanceof THREE.Color ? source.color.clone() : new THREE.Color("#dbeafe");

      if (tintColor) {
        baseColor.lerp(tintColor, tintStrength);
      }

      const toonMaterial = new THREE.MeshToonMaterial({
        color: baseColor,
        map: "map" in source ? source.map ?? null : null,
        gradientMap: gradientTexture,
        transparent: source.transparent,
        opacity: source.opacity,
        alphaTest: source.alphaTest,
        side: source.side,
        vertexColors: source.vertexColors,
      });

      toonMaterial.name = `${source.name || "material"}-toon`;
      toonMaterial.emissive = emissiveColor.clone();
      toonMaterial.emissiveIntensity = options?.emissiveIntensity ?? 0;
      toonMaterial.depthWrite = source.depthWrite;
      toonMaterial.depthTest = source.depthTest;
      toonMaterial.toneMapped = source.toneMapped;

      return toonMaterial;
    });

    child.material = Array.isArray(child.material) ? toonMaterials : toonMaterials[0];
    child.userData.gazepilotToonized = true;
  });
}
