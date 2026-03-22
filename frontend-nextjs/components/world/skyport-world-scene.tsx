"use client";

import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { CapsuleCollider, CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, Sparkles } from "@react-three/drei";
import type { MutableRefObject } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SkyportAvatar } from "@/components/world/skyport-avatar";
import { SkyportGltfEnvironment } from "@/components/world/skyport-gltf-environment";
import { SkyportLoadingOverlay } from "@/components/world/skyport-loading-overlay";
import { useSkyportWorldStore } from "@/components/world/use-skyport-world-store";
import type { AttentionSource } from "@/lib/gaze";
import { getDistrictActionByIndex, getDistrictById, SKYPORT_DISTRICTS, type DistrictActionId } from "@/lib/world-data";
import { cn } from "@/lib/utils";

interface SkyportWorldSceneProps {
  trackingMode: "remote" | "local";
  attentionSource: AttentionSource;
  attentionIntensity: number;
  attentionRawX: number;
  attentionRawY: number;
  eyeTrackingActive: boolean;
  blinkPulse: number;
  motionLatencyMs: number | null;
  openDistrictId: string | null;
  onCommitInteraction: (payload: {
    districtId: string;
    actionId: DistrictActionId;
    actionLabel: string;
    source: "blink" | "keyboard";
  }) => void;
}

interface KeyboardState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export function SkyportWorldScene({
  trackingMode,
  attentionSource,
  attentionIntensity,
  attentionRawX,
  attentionRawY,
  eyeTrackingActive,
  blinkPulse,
  motionLatencyMs,
  openDistrictId,
  onCommitInteraction,
}: SkyportWorldSceneProps) {
  const keyStateRef = useRef<KeyboardState>({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
  });
  const lastBlinkPulseRef = useRef(blinkPulse);
  const setSelectedActionIndex = useSkyportWorldStore((state) => state.setSelectedActionIndex);
  const selectedActionIndex = useSkyportWorldStore((state) => state.selectedActionIndex);
  const nearDistrictId = useSkyportWorldStore((state) => state.nearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const [worldReady, setWorldReady] = useState(false);

  const commitCurrentInteraction = useCallback(
    (source: "blink" | "keyboard") => {
      const action = getDistrictActionByIndex(nearDistrictId, selectedActionIndex);
      if (!nearDistrictId || !action) {
        return;
      }
      onCommitInteraction({
        districtId: nearDistrictId,
        actionId: action.id,
        actionLabel: action.label,
        source,
      });
    },
    [nearDistrictId, onCommitInteraction, selectedActionIndex],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      setWorldReady(true);
    }, 180);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keyStateRef.current.forward = true;
      } else if (key === "s" || key === "arrowdown") {
        keyStateRef.current.back = true;
      } else if (key === "a" || key === "arrowleft") {
        keyStateRef.current.left = true;
      } else if (key === "d" || key === "arrowright") {
        keyStateRef.current.right = true;
      } else if (key === "shift") {
        keyStateRef.current.sprint = true;
      } else if (key === "1") {
        setSelectedActionIndex(0, "keyboard");
      } else if (key === "2") {
        setSelectedActionIndex(1, "keyboard");
      } else if (key === "3") {
        setSelectedActionIndex(2, "keyboard");
      } else if ((event.key === "Enter" || event.key === " ") && nearDistrictId) {
        commitCurrentInteraction("keyboard");
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keyStateRef.current.forward = false;
      } else if (key === "s" || key === "arrowdown") {
        keyStateRef.current.back = false;
      } else if (key === "a" || key === "arrowleft") {
        keyStateRef.current.left = false;
      } else if (key === "d" || key === "arrowright") {
        keyStateRef.current.right = false;
      } else if (key === "shift") {
        keyStateRef.current.sprint = false;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [commitCurrentInteraction, nearDistrictId, setSelectedActionIndex]);

  useEffect(() => {
    if (!nearDistrictId) {
      return;
    }

    const sourceActive = eyeTrackingActive || (attentionSource !== "idle" && attentionIntensity > 0.16);
    if (!sourceActive) {
      return;
    }

    let nextIndex = 1;
    if (attentionRawX < 0.38) {
      nextIndex = 0;
    } else if (attentionRawX > 0.62) {
      nextIndex = 2;
    }

    setSelectedActionIndex(nextIndex, "eye");
  }, [attentionIntensity, attentionRawX, attentionSource, eyeTrackingActive, nearDistrictId, setSelectedActionIndex]);

  useEffect(() => {
    if (blinkPulse <= lastBlinkPulseRef.current) {
      return;
    }
    lastBlinkPulseRef.current = blinkPulse;
    if (!introReady || !nearDistrictId) {
      return;
    }
    commitCurrentInteraction("blink");
  }, [blinkPulse, commitCurrentInteraction, introReady, nearDistrictId]);

  const activeDistrict = getDistrictById(nearDistrictId);
  const activeAction = getDistrictActionByIndex(nearDistrictId, selectedActionIndex);

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(10,12,32,0.93))] shadow-[0_30px_90px_rgba(2,6,23,0.5)]">
      <Canvas camera={{ position: [0, 9, 22], fov: 42 }} shadows dpr={[1, 1.5]}>
        <SkyportSceneRoot
          keyStateRef={keyStateRef}
          openDistrictId={openDistrictId}
          trackingMode={trackingMode}
          attentionRawY={attentionRawY}
          motionLatencyMs={motionLatencyMs}
        />
      </Canvas>

      <SkyportLoadingOverlay trackingMode={trackingMode} worldReady={worldReady} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <ScenePill label="Mode" value="free roam" />
        <ScenePill label="Input" value={trackingMode === "local" ? "browser cam" : "esp32 relay"} />
        <ScenePill label="Motion" value={motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-slate-950/62 px-4 py-4 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">
                {activeDistrict ? activeDistrict.signLabel : "Skyport promenade"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{activeDistrict?.title ?? "Walk the district lanes"}</p>
              <p className="mt-2 text-sm text-white/58">
                {activeDistrict?.ambientLabel ?? "Use WASD/setas para andar. Aproximar abre as opcoes contextuais."}
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/68">
              {activeAction ? `selected ${activeAction.label}` : "no district nearby"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(activeDistrict?.actions ?? FALLBACK_ACTIONS).map((action, index) => (
              <div
                key={action.id}
                className={cn(
                  "rounded-[22px] border px-4 py-3 transition-all",
                  activeAction?.id === action.id
                    ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.16)]"
                    : "border-white/10 bg-white/[0.04] text-white/72",
                )}
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">slot 0{index + 1}</p>
                <p className="mt-2 text-sm font-semibold">{action.label}</p>
                <p className="mt-2 text-xs leading-5 text-white/56">{action.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/52">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">WASD move</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Shift sprint</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">1-2-3 select</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Enter or blink confirm</span>
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
  attentionRawY,
  motionLatencyMs,
}: {
  keyStateRef: MutableRefObject<KeyboardState>;
  openDistrictId: string | null;
  trackingMode: "remote" | "local";
  attentionRawY: number;
  motionLatencyMs: number | null;
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
      <color attach="background" args={["#050816"]} />
      <fog attach="fog" args={["#0a1020", 18, 78]} />

      <SkyBackdrop />
      <AtmosphereBands />
      <ambientLight intensity={0.62} />
      <hemisphereLight intensity={0.82} color="#fef3c7" groundColor="#0b1020" />
      <directionalLight
        castShadow
        intensity={2.9}
        color="#fff2c7"
        position={[16, 22, 10]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <pointLight intensity={58} color="#22d3ee" position={[0, 9, 2]} distance={44} />
      <pointLight intensity={36} color="#f472b6" position={[0, 6, -14]} distance={30} />

      <Physics gravity={[0, -24, 0]} timeStep="vary">
        <WorldBoundaries />
        <Ground gradientTexture={gradientTexture} />
        <Suspense fallback={null}>
          <SkyportGltfEnvironment gradientTexture={gradientTexture} openDistrictId={openDistrictId} districts={SKYPORT_DISTRICTS} />
        </Suspense>
        <QuantumHub gradientTexture={gradientTexture} />
        <HoverDrones gradientTexture={gradientTexture} />
        <Sparkles count={160} scale={[60, 20, 70]} position={[0, 9, 0]} size={2.2} speed={0.18} color="#67e8f9" />
        <PlayerController keyStateRef={keyStateRef} trackingMode={trackingMode} />
        <FollowCamera trackingMode={trackingMode} attentionRawY={attentionRawY} />
      </Physics>

      {introReady ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.55} mipmapBlur luminanceThreshold={0.42} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.16} darkness={0.9} />
        </EffectComposer>
      ) : null}

      <Html position={[0, 8.5, -18]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/56 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/70 backdrop-blur-md">
          Dream Expo City
          <span className="ml-2 text-white/35">{motionLatencyMs === null ? "--" : `${Math.round(motionLatencyMs)} ms`}</span>
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
  trackingMode: "remote" | "local";
}) {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const setPlayerPosition = useSkyportWorldStore((state) => state.setPlayerPosition);
  const setPlayerMotion = useSkyportWorldStore((state) => state.setPlayerMotion);
  const setNearDistrictId = useSkyportWorldStore((state) => state.setNearDistrictId);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const gradientTexture = useMemo(() => createToonGradientTexture(), []);
  const lastHeadingRef = useRef(Math.PI);
  const lastMotionRef = useRef<"idle" | "walk" | "run">("idle");

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
      if (lastMotionRef.current !== "idle") {
        lastMotionRef.current = "idle";
        setPlayerMotion("idle");
      }
      return;
    }

    const keys = keyStateRef.current;
    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const inputZ = (keys.back ? 1 : 0) - (keys.forward ? 1 : 0);
    const moveVector = new THREE.Vector3(inputX, 0, inputZ);
    const hasIntent = moveVector.lengthSq() > 0;
    const speed = keys.sprint ? (trackingMode === "local" ? 8.2 : 6.4) : trackingMode === "local" ? 5.7 : 4.6;
    const nextMotion: "idle" | "walk" | "run" = hasIntent ? (keys.sprint ? "run" : "walk") : "idle";

    if (hasIntent) {
      moveVector.normalize();
      body.setLinvel({ x: moveVector.x * speed, y: currentVelocity.y, z: moveVector.z * speed }, true);
      lastHeadingRef.current = Math.atan2(moveVector.x, moveVector.z);
    } else {
      body.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
    }

    const nextPosition = body.translation();
    setPlayerPosition([nextPosition.x, nextPosition.y, nextPosition.z]);
    setNearDistrictId(resolveNearbyDistrict(nextPosition.x, nextPosition.z));
    if (nextMotion !== lastMotionRef.current) {
      lastMotionRef.current = nextMotion;
      setPlayerMotion(nextMotion);
    }

    if (avatarRef.current) {
      const targetRotation = lastHeadingRef.current;
      avatarRef.current.rotation.y = THREE.MathUtils.lerp(avatarRef.current.rotation.y, targetRotation, 1 - Math.exp(-delta * 10));
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      position={[0, 1.4, 18]}
      enabledRotations={[false, false, false]}
      linearDamping={10}
      angularDamping={20}
      canSleep={false}
      friction={1.2}
    >
      <CapsuleCollider args={[0.78, 0.48]} position={[0, 0.78, 0]} />
      <group ref={avatarRef}>
        <Suspense fallback={<AvatarVisual gradientTexture={gradientTexture} />}>
          <SkyportAvatar gradientTexture={gradientTexture} />
        </Suspense>
      </group>
    </RigidBody>
  );
}

function AvatarVisual({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const rootRef = useRef<THREE.Group | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const bob = Math.sin(time * 4.6) * 0.035;
    if (rootRef.current) {
      rootRef.current.position.y = bob;
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + Math.sin(time * 2.8) * 0.06);
    }
  });

  return (
    <group ref={rootRef}>
      <mesh position={[0, 1.56, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.78, 6, 12]} />
        <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 2.46, 0]} castShadow>
        <sphereGeometry args={[0.42, 18, 18]} />
        <meshToonMaterial color="#f8dcc7" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 2.8, -0.02]} castShadow>
        <sphereGeometry args={[0.48, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
        <meshToonMaterial color="#13203f" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 1.92, 0.26]} castShadow>
        <boxGeometry args={[0.78, 0.48, 0.2]} />
        <meshToonMaterial color="#60a5fa" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[0, 1.58, -0.06]} castShadow>
        <boxGeometry args={[0.86, 0.68, 0.24]} />
        <meshToonMaterial color="#1d4ed8" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[-0.36, 1.48, 0]} castShadow rotation-z={0.18}>
        <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
        <meshToonMaterial color="#f8dcc7" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0.36, 1.48, 0]} castShadow rotation-z={-0.18}>
        <capsuleGeometry args={[0.1, 0.42, 4, 8]} />
        <meshToonMaterial color="#f8dcc7" gradientMap={gradientTexture} />
      </mesh>

      <mesh position={[-0.18, 0.76, 0]} castShadow rotation-z={0.06}>
        <capsuleGeometry args={[0.12, 0.58, 4, 8]} />
        <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0.18, 0.76, 0]} castShadow rotation-z={-0.06}>
        <capsuleGeometry args={[0.12, 0.58, 4, 8]} />
        <meshToonMaterial color="#0f172a" gradientMap={gradientTexture} />
      </mesh>

      <mesh ref={haloRef} position={[0, 3.32, 0]}>
        <torusGeometry args={[0.36, 0.04, 12, 48]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function FollowCamera({
  trackingMode,
  attentionRawY,
}: {
  trackingMode: "remote" | "local";
  attentionRawY: number;
}) {
  const { camera } = useThree();
  const playerPosition = useSkyportWorldStore((state) => state.playerPosition);
  const introReady = useSkyportWorldStore((state) => state.introReady);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const cameraLift = trackingMode === "local" ? 0 : 0.8;
    const verticalBias = THREE.MathUtils.mapLinear(attentionRawY, 0, 1, 1.2, -0.8);
    target.set(playerPosition[0], playerPosition[1] + 5.8 + cameraLift + verticalBias * 0.18, playerPosition[2] + 11.8);

    if (!introReady) {
      target.set(playerPosition[0], playerPosition[1] + 13.5, playerPosition[2] + 26);
    }

    const alpha = 1 - Math.exp(-delta * 4.4);
    camera.position.lerp(target, alpha);
    lookAt.set(playerPosition[0], playerPosition[1] + 1.7, playerPosition[2] - 1.4);
    camera.lookAt(lookAt);
  });

  return null;
}

function Ground({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[130, 130]} />
          <meshToonMaterial color="#082032" gradientMap={gradientTexture} />
        </mesh>
        <CuboidCollider args={[65, 0.1, 65]} position={[0, -0.1, 0]} />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]}>
        <planeGeometry args={[130, 130]} />
        <meshBasicMaterial color="#11213e" transparent opacity={0.12} />
      </mesh>
    </>
  );
}

function SkyportPromenade({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const strips = useMemo(() => [-18, -9, 0, 9, 18], []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[18, 56]} />
        <meshToonMaterial color="#132138" gradientMap={gradientTexture} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.35, 56]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.44} />
      </mesh>
      {strips.map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.026, z]}>
          <planeGeometry args={[18, 0.12]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.16} />
        </mesh>
      ))}
    </>
  );
}

function QuantumHub({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  return (
    <group position={[0, 0, 0]}>
      <Float speed={1.3} rotationIntensity={0.16} floatIntensity={0.22}>
        <mesh position={[0, 3.6, 0]} castShadow>
          <torusGeometry args={[1.9, 0.13, 18, 72]} />
          <meshToonMaterial color="#67e8f9" gradientMap={gradientTexture} />
        </mesh>
      </Float>
      <mesh position={[0, 0.44, 0]} castShadow>
        <cylinderGeometry args={[2.6, 3.2, 0.5, 64]} />
        <meshToonMaterial color="#0b1528" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 1.72, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.15, 2.14, 8]} />
        <meshToonMaterial color="#172554" gradientMap={gradientTexture} />
      </mesh>
      <mesh position={[0, 0.55, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.4, 4.2, 64]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function HoverDrones({ gradientTexture }: { gradientTexture: THREE.DataTexture }) {
  const drones = useMemo(
    () => [
      { id: "dr-1", position: [-16, 6.4, 2] as [number, number, number] },
      { id: "dr-2", position: [14, 7.2, -4] as [number, number, number] },
      { id: "dr-3", position: [5, 5.8, 16] as [number, number, number] },
    ],
    [],
  );

  return (
    <>
      {drones.map((drone) => (
        <Float key={drone.id} speed={1.3} rotationIntensity={0.18} floatIntensity={0.3}>
          <group position={drone.position}>
            <mesh castShadow>
              <sphereGeometry args={[0.34, 16, 16]} />
              <meshToonMaterial color="#dbeafe" gradientMap={gradientTexture} />
            </mesh>
            <mesh position={[0, 0, 0.36]}>
              <ringGeometry args={[0.18, 0.24, 24]} />
              <meshBasicMaterial color="#67e8f9" transparent opacity={0.8} />
            </mesh>
          </group>
        </Float>
      ))}
    </>
  );
}

function WorldBoundaries() {
  const wallColor = "#0f172a";
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[36, 3, 0.8]} position={[0, 3, -31]} />
        <CuboidCollider args={[36, 3, 0.8]} position={[0, 3, 31]} />
        <CuboidCollider args={[0.8, 3, 31]} position={[-31, 3, 0]} />
        <CuboidCollider args={[0.8, 3, 31]} position={[31, 3, 0]} />
      </RigidBody>
      <mesh position={[0, 3, -31]}>
        <boxGeometry args={[72, 6, 0.6]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
      <mesh position={[0, 3, 31]}>
        <boxGeometry args={[72, 6, 0.6]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
      <mesh position={[-31, 3, 0]}>
        <boxGeometry args={[0.6, 6, 62]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
      <mesh position={[31, 3, 0]}>
        <boxGeometry args={[0.6, 6, 62]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.04} />
      </mesh>
    </>
  );
}

function SkyBackdrop() {
  const shader = useMemo(
    () => ({
      uniforms: {
        topColor: { value: new THREE.Color("#182b58") },
        middleColor: { value: new THREE.Color("#3a2b68") },
        bottomColor: { value: new THREE.Color("#fff1cc") },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 middleColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, 18.0, 0.0)).y;
          vec3 color = mix(bottomColor, middleColor, smoothstep(-0.1, 0.38, h));
          color = mix(color, topColor, smoothstep(0.28, 0.95, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    }),
    [],
  );

  return (
    <group>
      <mesh>
        <sphereGeometry args={[90, 32, 32]} />
        <shaderMaterial args={[shader]} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 24, -40]}>
        <circleGeometry args={[7, 40]} />
        <meshBasicMaterial color="#fff1cc" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function AtmosphereBands() {
  const ribbons = useMemo(
    () => [
      { id: "a", position: [-18, 16, -22] as [number, number, number], rotationZ: 0.18, color: "#7dd3fc", opacity: 0.12 },
      { id: "b", position: [12, 13, -18] as [number, number, number], rotationZ: -0.22, color: "#f9a8d4", opacity: 0.08 },
      { id: "c", position: [0, 9, -28] as [number, number, number], rotationZ: 0.04, color: "#fde68a", opacity: 0.1 },
    ],
    [],
  );

  return (
    <>
      {ribbons.map((ribbon) => (
        <Float key={ribbon.id} speed={0.7} rotationIntensity={0.08} floatIntensity={0.22}>
          <mesh position={ribbon.position} rotation-z={ribbon.rotationZ}>
            <planeGeometry args={[26, 5]} />
            <meshBasicMaterial color={ribbon.color} transparent opacity={ribbon.opacity} side={THREE.DoubleSide} />
          </mesh>
        </Float>
      ))}
    </>
  );
}

const FALLBACK_ACTIONS = [
  { id: "story", label: "Approach", description: "Caminhe ate um distrito para ativar as opcoes." },
  { id: "enter", label: "Focus", description: "Use o olho para selecionar um slot contextual." },
  { id: "challenge", label: "Confirm", description: "Blink ou Enter para confirmar a acao." },
];

function ScenePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-center text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
      <span className="text-white/40">{label}</span> {value}
    </div>
  );
}

function createToonGradientTexture() {
  const data = new Uint8Array([
    38, 48, 84,
    84, 112, 168,
    160, 201, 255,
    255, 244, 214,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
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
