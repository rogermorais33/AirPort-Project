"use client";

import { AdaptiveDpr, Preload, Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import type { MutableRefObject, PointerEvent, WheelEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { CollisionWorld } from "@/components/world/CollisionWorld";
import { Districts } from "@/components/world/Districts";
import { NPCSystem } from "@/components/world/NPCSystem";
import { PlayerController, resetCameraRig } from "@/components/world/PlayerController";
import { SkyportLoadingOverlay } from "@/components/world/skyport-loading-overlay";
import { ThirdPersonCamera } from "@/components/world/ThirdPersonCamera";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import { WorldHUD } from "@/components/world/WorldHUD";
import { WorldMap } from "@/components/world/WorldMap";
import { CAMERA_DEFAULT, CAMERA_LIMITS } from "@/components/world/world-config";
import type { CameraRigRef, KeyboardState, SkyportWorldSceneProps } from "@/components/world/world-types";
import { clamp, createToonGradientTexture } from "@/components/world/world-utils";

export function WorldCanvas({
  trackingMode,
  blinkPulse,
  motionLatencyMs,
  openDistrictId,
  onEnterDistrict,
}: SkyportWorldSceneProps) {
  const keyStateRef = useRef<KeyboardState>({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    cameraLeft: false,
    cameraRight: false,
  });
  const cameraRigRef = useRef({ ...CAMERA_DEFAULT }) as CameraRigRef;
  const dragRef = useRef<{ active: boolean; pointerId: number | null; x: number; y: number }>({
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
  });
  const lastBlinkPulseRef = useRef(blinkPulse);
  const [worldReady, setWorldReady] = useState(false);
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const setIntroReady = useSkyportWorldStore((state) => state.setIntroReady);

  const enterCurrentDistrict = useCallback(
    (source: "blink" | "keyboard" | "click") => {
      if (!nearDistrictId) {
        return;
      }
      onEnterDistrict({ districtId: nearDistrictId, source });
    },
    [nearDistrictId, onEnterDistrict],
  );

  useEffect(() => {
    setIntroReady(false);
    const id = window.setTimeout(() => {
      setWorldReady(true);
    }, 180);
    return () => {
      window.clearTimeout(id);
      setIntroReady(false);
    };
  }, [setIntroReady]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function resetKeys() {
      keyStateRef.current.forward = false;
      keyStateRef.current.back = false;
      keyStateRef.current.left = false;
      keyStateRef.current.right = false;
      keyStateRef.current.sprint = false;
      keyStateRef.current.cameraLeft = false;
      keyStateRef.current.cameraRight = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const code = event.code;
      const handled =
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "ShiftLeft" ||
        code === "ShiftRight" ||
        code === "KeyQ" ||
        code === "KeyE" ||
        code === "KeyR" ||
        code === "Enter" ||
        code === "Space";

      if (handled) {
        event.preventDefault();
      }

      if (code === "KeyW" || code === "ArrowUp") {
        keyStateRef.current.forward = true;
      } else if (code === "KeyS" || code === "ArrowDown") {
        keyStateRef.current.back = true;
      } else if (code === "KeyA" || code === "ArrowLeft") {
        keyStateRef.current.left = true;
      } else if (code === "KeyD" || code === "ArrowRight") {
        keyStateRef.current.right = true;
      } else if (code === "ShiftLeft" || code === "ShiftRight") {
        keyStateRef.current.sprint = true;
      } else if (code === "KeyQ") {
        keyStateRef.current.cameraLeft = true;
      } else if (code === "KeyE") {
        keyStateRef.current.cameraRight = true;
      } else if (code === "KeyR") {
        resetCameraRig(cameraRigRef);
      } else if ((code === "Enter" || code === "Space") && nearDistrictId) {
        enterCurrentDistrict("keyboard");
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const code = event.code;
      if (code === "KeyW" || code === "ArrowUp") {
        keyStateRef.current.forward = false;
      } else if (code === "KeyS" || code === "ArrowDown") {
        keyStateRef.current.back = false;
      } else if (code === "KeyA" || code === "ArrowLeft") {
        keyStateRef.current.left = false;
      } else if (code === "KeyD" || code === "ArrowRight") {
        keyStateRef.current.right = false;
      } else if (code === "ShiftLeft" || code === "ShiftRight") {
        keyStateRef.current.sprint = false;
      } else if (code === "KeyQ") {
        keyStateRef.current.cameraLeft = false;
      } else if (code === "KeyE") {
        keyStateRef.current.cameraRight = false;
      }
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("blur", resetKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetKeys);
    };
  }, [enterCurrentDistrict, nearDistrictId]);

  useEffect(() => {
    if (blinkPulse <= lastBlinkPulseRef.current) {
      return;
    }
    lastBlinkPulseRef.current = blinkPulse;
    if (!introReady || !nearDistrictId) {
      return;
    }
    enterCurrentDistrict("blink");
  }, [blinkPulse, enterCurrentDistrict, introReady, nearDistrictId]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;

    cameraRigRef.current.yaw -= dx * 0.0052;
    cameraRigRef.current.pitch = clamp(cameraRigRef.current.pitch + dy * 0.0038, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch);
    event.preventDefault();
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId) {
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    cameraRigRef.current.distance = clamp(
      cameraRigRef.current.distance + event.deltaY * 0.008,
      CAMERA_LIMITS.minDistance,
      CAMERA_LIMITS.maxDistance,
    );
  }, []);

  return (
    <div
      className="relative h-[76vh] min-h-[600px] overflow-hidden rounded-[36px] border border-white/10 bg-slate-950 shadow-[0_30px_90px_rgba(2,6,23,0.5)] md:h-[86vh] md:min-h-[800px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        className="h-full w-full"
        camera={{ position: [8, 7, 18], fov: 48, near: 0.1, far: 430 }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        dpr={[1, 1.65]}
      >
        <Suspense fallback={null}>
          <WorldSceneRoot
            cameraRigRef={cameraRigRef}
            keyStateRef={keyStateRef}
            openDistrictId={openDistrictId}
            trackingMode={trackingMode}
            onSelectDistrict={(districtId) => onEnterDistrict({ districtId, source: "click" })}
          />
        </Suspense>
      </Canvas>

      <WorldHUD trackingMode={trackingMode} motionLatencyMs={motionLatencyMs} openDistrictId={openDistrictId} />
      <SkyportLoadingOverlay trackingMode={trackingMode} worldReady={worldReady} />
    </div>
  );
}

function WorldSceneRoot({
  cameraRigRef,
  keyStateRef,
  openDistrictId,
  trackingMode,
  onSelectDistrict,
}: {
  cameraRigRef: CameraRigRef;
  keyStateRef: MutableRefObject<KeyboardState>;
  openDistrictId: string | null;
  trackingMode: SkyportWorldSceneProps["trackingMode"];
  onSelectDistrict: (districtId: string) => void;
}) {
  const gradientTexture = useMemo(() => createToonGradientTexture(), []);

  useEffect(() => {
    return () => {
      gradientTexture.dispose();
    };
  }, [gradientTexture]);

  return (
    <>
      <color attach="background" args={["#7fb7df"]} />
      <fogExp2 attach="fog" args={["#b9d7e6", 0.0052]} />

      <ambientLight intensity={0.32} />
      <hemisphereLight intensity={0.92} color="#fff5d6" groundColor="#31545d" />
      <directionalLight
        castShadow
        intensity={1.72}
        color="#ffd8a3"
        position={[34, 46, 24]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={210}
        shadow-camera-left={-78}
        shadow-camera-right={78}
        shadow-camera-top={78}
        shadow-camera-bottom={-78}
      />
      <directionalLight intensity={0.36} color="#d7ecff" position={[-32, 24, -38]} />
      <pointLight intensity={1.4} color="#67e8f9" position={[0, 7, 3]} distance={32} />
      <pointLight intensity={1.3} color="#fde68a" position={[0, 7, 44]} distance={36} />

      <Physics gravity={[0, -26, 0]} timeStep="vary">
        <CollisionWorld />
        <WorldMap gradientTexture={gradientTexture} />
        <Districts gradientTexture={gradientTexture} openDistrictId={openDistrictId} onSelectDistrict={onSelectDistrict} />
        <NPCSystem gradientTexture={gradientTexture} />
        <Sparkles count={70} scale={[150, 30, 150]} position={[0, 17, 0]} size={1.6} speed={0.08} color="#e0f2fe" />
        <PlayerController cameraRigRef={cameraRigRef} keyStateRef={keyStateRef} trackingMode={trackingMode} />
        <ThirdPersonCamera cameraRigRef={cameraRigRef} trackingMode={trackingMode} />
      </Physics>

      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}
