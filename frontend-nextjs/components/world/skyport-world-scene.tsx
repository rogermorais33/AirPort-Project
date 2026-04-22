"use client";

import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { CapsuleCollider, CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, Sky, Sparkles } from "@react-three/drei";
import type { MutableRefObject } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SkyportAvatar } from "@/components/world/skyport-avatar";
import { SkyportGltfEnvironment } from "@/components/world/skyport-gltf-environment";
import { SkyportLoadingOverlay } from "@/components/world/skyport-loading-overlay";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import { getDistrictById, SKYPORT_DISTRICTS } from "@/lib/world-data";

interface SkyportWorldSceneProps {
  trackingMode: "off" | "remote" | "local";
  blinkPulse: number;
  motionLatencyMs: number | null;
  openDistrictId: string | null;
  onEnterDistrict: (payload: {
    districtId: string;
    source: "blink" | "keyboard" | "click";
  }) => void;
}

interface KeyboardState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

const PLAYER_SPAWN: [number, number, number] = [0, 1, 8];
const INITIAL_PLAYER_HEADING = Math.PI;
const INITIAL_CAMERA_POSITION: [number, number, number] = [6.8, 6.4, 15.6];
const INITIAL_CAMERA_LOOK_AT: [number, number, number] = [0, 1.35, 7.2];

export function SkyportWorldScene({
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
  });
  const lastBlinkPulseRef = useRef(blinkPulse);
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const setIntroReady = useSkyportWorldStore((state) => state.setIntroReady);
  const [worldReady, setWorldReady] = useState(false);

  const enterCurrentDistrict = useCallback(
    (source: "blink" | "keyboard" | "click") => {
      if (!nearDistrictId) {
        return;
      }
      onEnterDistrict({
        districtId: nearDistrictId,
        source,
      });
    },
    [nearDistrictId, onEnterDistrict],
  );

  useEffect(() => {
    setIntroReady(false);
    return () => {
      setIntroReady(false);
    };
  }, [setIntroReady]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setWorldReady(true);
    }, 180);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

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
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const code = event.code;
      const isMoveKey =
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
        code === "Enter" ||
        code === "Space";

      if (isMoveKey) {
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
      } else if ((code === "Enter" || code === "Space") && nearDistrictId) {
        enterCurrentDistrict("keyboard");
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const code = event.code;
      const isMoveKey =
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "ShiftLeft" ||
        code === "ShiftRight";

      if (isMoveKey) {
        event.preventDefault();
      }

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

  const activeDistrict = getDistrictById(nearDistrictId);

  return (
    <div className="relative h-[72vh] min-h-[560px] overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(6,23,45,0.96),rgba(8,18,32,0.93))] shadow-[0_30px_90px_rgba(2,6,23,0.5)] md:h-[84vh] md:min-h-[760px]">
      <Canvas
        className="h-full w-full"
        camera={{ position: INITIAL_CAMERA_POSITION, fov: 50 }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.8]}
      >
        <SkyportSceneRoot
          keyStateRef={keyStateRef}
          openDistrictId={openDistrictId}
          trackingMode={trackingMode}
          motionLatencyMs={motionLatencyMs}
          onSelectDistrict={(districtId) => {
            onEnterDistrict({
              districtId,
              source: "click",
            });
          }}
        />
      </Canvas>

      <SkyportLoadingOverlay trackingMode={trackingMode} worldReady={worldReady} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <ScenePill label="Mode" value="town square" />
        <ScenePill
          label="Input"
          value={trackingMode === "local" ? "browser cam" : trackingMode === "remote" ? "esp32 relay" : "keyboard only"}
        />
        <ScenePill label="Motion" value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`} />
      </div>

      <div className="pointer-events-none absolute left-4 top-16">
        <div className="max-w-sm rounded-[24px] border border-white/10 bg-slate-950/52 px-4 py-3 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">
                {activeDistrict ? activeDistrict.signLabel : "Skyport district"}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{activeDistrict?.title ?? "Explore central town"}</p>
              <p className="mt-2 text-sm text-white/58">
                {activeDistrict?.subtitle ?? "Use WASD/setas para andar. Chegue perto de um lugar e pressione Enter para entrar."}
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/68">
              {activeDistrict ? "enter venue" : "roaming"}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/52">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">WASD move</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Shift sprint</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Enter enter venue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkyportSceneRoot({
  keyStateRef,
  openDistrictId,
  trackingMode,
  motionLatencyMs,
  onSelectDistrict,
}: {
  keyStateRef: MutableRefObject<KeyboardState>;
  openDistrictId: string | null;
  trackingMode: "off" | "remote" | "local";
  motionLatencyMs: number | null;
  onSelectDistrict: (districtId: string) => void;
}) {
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const gradientTexture = useMemo(() => createToonGradientTexture(), []);

  useEffect(() => {
    return () => {
      gradientTexture.dispose();
    };
  }, [gradientTexture]);

  return (
    <>
      <color attach="background" args={["#6e8fb3"]} />
      <fogExp2 attach="fog" args={["#9db9d8", 0.0038]} />

      <InitialCameraPose />
      <Sky distance={450000} sunPosition={[120, 42, -90]} turbidity={9} rayleigh={1.7} mieCoefficient={0.005} mieDirectionalG={0.77} />
      <AtmosphereClouds />

      <ambientLight intensity={0.4} />
      <hemisphereLight intensity={0.86} color="#fff3d2" groundColor="#3b5368" />
      <directionalLight
        castShadow
        intensity={1.6}
        color="#ffd7a8"
        position={[30, 42, 22]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <directionalLight intensity={0.46} color="#cde2ff" position={[-28, 22, -30]} />
      <pointLight intensity={2.9} color="#86efac" position={[0, 8, 0]} distance={52} />
      <pointLight intensity={1.2} color="#38bdf8" position={[-18, 6, 6]} distance={42} />
      <pointLight intensity={1.2} color="#f97316" position={[18, 6, -8]} distance={42} />

      <Physics gravity={[0, -24, 0]} timeStep="vary">
        <WorldBoundaries />
        <GroundPlane />

        <SkyportGltfEnvironment
          gradientTexture={gradientTexture}
          openDistrictId={openDistrictId}
          districts={SKYPORT_DISTRICTS}
          onSelectDistrict={onSelectDistrict}
        />

        <Sparkles count={52} scale={[160, 30, 160]} position={[0, 14, 0]} size={1.8} speed={0.09} color="#d9f99d" />
        <AmbientBalloons gradientTexture={gradientTexture} />

        <PlayerController keyStateRef={keyStateRef} trackingMode={trackingMode} />
        <FollowCamera trackingMode={trackingMode} />
      </Physics>

      {introReady ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.28} mipmapBlur luminanceThreshold={0.56} />
          <Noise opacity={0.015} />
          <Vignette eskil={false} offset={0.16} darkness={0.68} />
        </EffectComposer>
      ) : null}

      <Html position={[0, 10.5, -30]} center>
        <div className="rounded-full border border-white/15 bg-slate-950/60 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/72 backdrop-blur-md">
          Skyport Town Square
          <span className="ml-2 text-white/38">{motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`}</span>
        </div>
      </Html>
    </>
  );
}

function PlayerController({
  keyStateRef,
  trackingMode,
}: {
  keyStateRef: MutableRefObject<KeyboardState>;
  trackingMode: "off" | "remote" | "local";
}) {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const setPlayerPosition = useSkyportWorldStore((state) => state.setPlayerPosition);
  const setPlayerHeading = useSkyportWorldStore((state) => state.setPlayerHeading);
  const setPlayerMotion = useSkyportWorldStore((state) => state.setPlayerMotion);
  const setNearDistrictId = useSkyportWorldStore((state) => state.setNearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const gradientTexture = useMemo(() => createToonGradientTexture(), []);

  const lastHeadingRef = useRef(INITIAL_PLAYER_HEADING);
  const lastMotionRef = useRef<"idle" | "walk" | "run">("idle");
  const desiredVelocity = useMemo(() => new THREE.Vector3(), []);
  const smoothedVelocity = useMemo(() => new THREE.Vector3(), []);

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

    const keys = keyStateRef.current;
    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const inputZ = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const hasIntent = inputX !== 0 || inputZ !== 0;

    const walkSpeed = trackingMode === "remote" ? 4.4 : 4.9;
    const sprintSpeed = trackingMode === "remote" ? 6.4 : 7;
    const targetSpeed = keys.sprint ? sprintSpeed : walkSpeed;

    desiredVelocity.set(0, 0, 0);
    if (hasIntent) {
      // World-axis locomotion keeps WASD predictable regardless of camera settling.
      desiredVelocity.set(inputX, 0, -inputZ);
      desiredVelocity.normalize().multiplyScalar(targetSpeed);

      const targetHeading = Math.atan2(desiredVelocity.x, desiredVelocity.z);
      lastHeadingRef.current = dampAngle(lastHeadingRef.current, targetHeading, delta, 12);
    }

    smoothedVelocity.set(currentVelocity.x, 0, currentVelocity.z);
    const smoothing = hasIntent ? 12 : 18;
    smoothedVelocity.lerp(desiredVelocity, 1 - Math.exp(-delta * smoothing));

    body.setLinvel({ x: smoothedVelocity.x, y: currentVelocity.y, z: smoothedVelocity.z }, true);

    const nextPosition = body.translation();
    setPlayerPosition([nextPosition.x, nextPosition.y, nextPosition.z]);
    setPlayerHeading(lastHeadingRef.current);
    setNearDistrictId(resolveNearbyDistrict(nextPosition.x, nextPosition.z));

    const horizontalSpeed = smoothedVelocity.length();
    const nextMotion: "idle" | "walk" | "run" =
      horizontalSpeed < 0.2 ? "idle" : keys.sprint && horizontalSpeed > walkSpeed * 1.08 ? "run" : "walk";

    if (nextMotion !== lastMotionRef.current) {
      lastMotionRef.current = nextMotion;
      setPlayerMotion(nextMotion);
    }

    if (avatarRef.current) {
      avatarRef.current.rotation.y = dampAngle(avatarRef.current.rotation.y, lastHeadingRef.current, delta, 12);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      position={PLAYER_SPAWN}
      enabledRotations={[false, false, false]}
      linearDamping={10}
      angularDamping={20}
      canSleep={false}
      friction={1.2}
    >
      <CapsuleCollider args={[0.52, 0.36]} position={[0, 0.9, 0]} />
      <group ref={avatarRef}>
        <AvatarActor gradientTexture={gradientTexture} />
      </group>
    </RigidBody>
  );
}

function AvatarActor({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <Suspense fallback={<AvatarShell gradientTexture={gradientTexture} />}>
      <SkyportAvatar gradientTexture={gradientTexture} />
    </Suspense>
  );
}

function AvatarShell({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const motion = useSkyportWorldStore((state) => state.playerMotion);
  const rootRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const bob = motion === "idle" ? 0.01 : motion === "walk" ? 0.03 : 0.05;
    const speed = motion === "idle" ? 2 : motion === "walk" ? 6 : 8;
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * speed) * bob;
    }
  });

  return (
    <group ref={rootRef}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} renderOrder={-1}>
        <circleGeometry args={[0.42, 28]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.16} />
      </mesh>

      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.88, 6, 12]} />
        <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshToonMaterial color="#f8fafc" gradientMap={gradientTexture} />
      </mesh>
    </group>
  );
}

function FollowCamera({
  trackingMode,
}: {
  trackingMode: "off" | "remote" | "local";
}) {
  const { camera } = useThree();
  const playerPosition = useSkyportWorldStore((state) => state.playerPosition);
  const introReady = useSkyportWorldStore((state) => state.introReady);

  const target = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const smoothedLookAt = useMemo(() => new THREE.Vector3(...INITIAL_CAMERA_LOOK_AT), []);

  useFrame((_, delta) => {
    const lateralOffset = trackingMode === "remote" ? 7.2 : 6.6;
    const depthOffset = trackingMode === "remote" ? 8.6 : 7.8;
    const height = trackingMode === "remote" ? 6.8 : 6.1;

    target.set(
      playerPosition[0] + lateralOffset,
      playerPosition[1] + height,
      playerPosition[2] + depthOffset,
    );

    if (!introReady) {
      target.set(playerPosition[0] + 22, playerPosition[1] + 15, playerPosition[2] + 26);
    }

    camera.position.lerp(target, 1 - Math.exp(-delta * 4.8));

    lookAt.set(playerPosition[0], playerPosition[1] + 1.28, playerPosition[2] - 0.4);

    smoothedLookAt.lerp(lookAt, 1 - Math.exp(-delta * 7.4));
    camera.lookAt(smoothedLookAt);
  });

  return null;
}

function InitialCameraPose() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...INITIAL_CAMERA_POSITION);
    camera.lookAt(...INITIAL_CAMERA_LOOK_AT);
  }, [camera]);

  return null;
}

function GroundPlane() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[140, 0.1, 140]} position={[0, -0.1, 0]} />
      </RigidBody>

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshBasicMaterial color="#213447" />
      </mesh>
    </>
  );
}

function AmbientBalloons({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const balloons = useMemo(
    () => [
      { id: "balloon-1", position: [-26, 20, -18] as [number, number, number], color: "#fef3c7" },
      { id: "balloon-2", position: [28, 22, 8] as [number, number, number], color: "#dbeafe" },
      { id: "balloon-3", position: [8, 18, 30] as [number, number, number], color: "#fce7f3" },
    ],
    [],
  );

  return (
    <>
      {balloons.map((balloon) => (
        <Float key={balloon.id} speed={0.7} rotationIntensity={0.1} floatIntensity={0.26}>
          <group position={balloon.position}>
            <mesh castShadow>
              <sphereGeometry args={[0.7, 18, 18]} />
              <meshToonMaterial color={balloon.color} gradientMap={gradientTexture} />
            </mesh>
            <mesh position={[0, -0.8, 0]}>
              <cylinderGeometry args={[0.03, 0.05, 1.4, 6]} />
              <meshToonMaterial color="#1f2937" gradientMap={gradientTexture} />
            </mesh>
          </group>
        </Float>
      ))}
    </>
  );
}

function AtmosphereClouds() {
  const ribbons = useMemo(
    () => [
      { id: "cloud-a", position: [-34, 24, -60] as [number, number, number], color: "#e5f1ff", opacity: 0.15 },
      { id: "cloud-b", position: [24, 20, -52] as [number, number, number], color: "#ffe7c3", opacity: 0.12 },
      { id: "cloud-c", position: [4, 17, -70] as [number, number, number], color: "#f8fafc", opacity: 0.11 },
    ],
    [],
  );

  return (
    <>
      {ribbons.map((ribbon) => (
        <Float key={ribbon.id} speed={0.5} rotationIntensity={0.05} floatIntensity={0.14}>
          <mesh position={ribbon.position}>
            <planeGeometry args={[34, 8]} />
            <meshBasicMaterial color={ribbon.color} transparent opacity={ribbon.opacity} side={THREE.DoubleSide} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function WorldBoundaries() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[94, 4, 0.8]} position={[0, 4, -92]} />
      <CuboidCollider args={[94, 4, 0.8]} position={[0, 4, 92]} />
      <CuboidCollider args={[0.8, 4, 92]} position={[-92, 4, 0]} />
      <CuboidCollider args={[0.8, 4, 92]} position={[92, 4, 0]} />
    </RigidBody>
  );
}

function ScenePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-center text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
      <span className="text-white/40">{label}</span> {value}
    </div>
  );
}

function createToonGradientTexture() {
  const data = new Uint8Array([
    32, 56, 85, 255,
    80, 120, 160, 255,
    150, 204, 255, 255,
    255, 246, 220, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function resolveNearbyDistrict(x: number, z: number) {
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

function dampAngle(current: number, target: number, delta: number, lambda: number) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-delta * lambda));
}
