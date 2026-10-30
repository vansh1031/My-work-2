// The 3D factory floor behind the factory and machine pages.
// Nothing selected: the camera slowly circles the whole floor. A machine selected: the camera flies to it, the
// other machines fade out and the selected one slowly turns. Switching machines sweeps the camera around the floor
// (config/animation.json factoryFloor.switchSweepDegrees) before closing in.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Machine } from "@fa/shared";
import { useConfig } from "../../config/ConfigProvider";
import { useFileUrl } from "../../lib/fileUrl";
import { useSceneState } from "../../state/SceneProvider";
import { layoutMachines, type Placement } from "./layout";
import { MachineModel } from "./MachineModels";

interface Props {
  machines: Machine[];
  selectedId: number | null;
}

interface CameraState {
  az: number;
  polar: number;
  radius: number;
  target: THREE.Vector3;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const TAU = Math.PI * 2;

function shortestAngle(from: number, to: number) {
  return ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
}

function overviewCamera(radius: number, az: number): CameraState {
  // On portrait screens the cards panel covers the lower part, so step back to fit the floor in the strip above it.
  const portrait = window.innerWidth < window.innerHeight;
  return { az, polar: 0.95, radius: radius * (portrait ? 2.6 : 1.85), target: new THREE.Vector3(0, 0.4, 0) };
}

function focusCamera(p: Placement): CameraState {
  return { az: Math.atan2(p.x, p.z), polar: 1.1, radius: 10, target: new THREE.Vector3(p.x, 1.4, p.z) };
}

/** Shifts the picture so the subject sits in the part of the screen not covered by the cards panel. */
function usePanelOffset() {
  const { camera, size } = useThree();
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const panel = document.querySelector(".side-panel")?.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (panel) {
      if (panel.right < size.width * 0.65) dx = -panel.right / 2;
      else dy = (size.height - panel.top) / 2;
    }
    const v = cam.view;
    if (!v || v.offsetX !== dx || v.offsetY !== dy || v.fullWidth !== size.width || v.fullHeight !== size.height) {
      cam.setViewOffset(size.width, size.height, dx, dy, size.width, size.height);
    }
  });
}

function CameraRig({ placements, radius, selectedId }: { placements: Placement[]; radius: number; selectedId: number | null }) {
  const { config, reduceMotion } = useConfig();
  const { setMoving, setDebugInfo } = useSceneState();
  const anim = config.animation.factoryFloor;
  const { camera } = useThree();
  const state = useRef<CameraState>(overviewCamera(radius, 0.6));
  const tween = useRef<{ from: CameraState; to: CameraState; sweep: number; bump: number; start: number; duration: number } | null>(null);
  const previous = useRef<number | null | undefined>(undefined);
  usePanelOffset();

  useEffect(() => {
    const before = previous.current;
    previous.current = selectedId;
    const placement = placements.find((p) => p.id === selectedId);
    const to = placement ? focusCamera(placement) : overviewCamera(radius, state.current.az);
    // First frame of the page: jump straight there.
    if (before === undefined || reduceMotion) {
      state.current = to;
      tween.current = null;
      return;
    }
    const from = { ...state.current, target: state.current.target.clone() };
    const switching = before !== null && selectedId !== null;
    let delta = shortestAngle(from.az, to.az);
    if (switching) delta += (delta >= 0 ? 1 : -1) * THREE.MathUtils.degToRad(anim.switchSweepDegrees);
    to.az = from.az + delta;
    tween.current = {
      from,
      to,
      sweep: 0,
      bump: switching ? radius * 0.9 : 0,
      start: performance.now(),
      duration: switching ? anim.switchDurationMs : anim.focusDurationMs,
    };
    setMoving(true);
    setDebugInfo({ floor: { selected: selectedId, move: switching ? "switch" : placement ? "focus" : "overview" } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, placements, radius]);

  useFrame((_, dt) => {
    const t = tween.current;
    if (t) {
      const k = Math.min(1, (performance.now() - t.start) / Math.max(1, t.duration));
      const e = easeInOut(k);
      state.current = {
        az: t.from.az + (t.to.az - t.from.az) * e,
        polar: t.from.polar + (t.to.polar - t.from.polar) * e,
        radius: t.from.radius + (t.to.radius - t.from.radius) * e + Math.sin(Math.PI * k) * t.bump,
        target: t.from.target.clone().lerp(t.to.target, e),
      };
      if (k >= 1) {
        tween.current = null;
        setMoving(false);
      }
    } else if (selectedId === null && !reduceMotion) {
      state.current.az += THREE.MathUtils.degToRad(anim.idleOrbitDegreesPerSecond) * dt;
    }
    const s = state.current;
    camera.position.set(
      s.target.x + s.radius * Math.sin(s.polar) * Math.sin(s.az),
      s.target.y + s.radius * Math.cos(s.polar),
      s.target.z + s.radius * Math.sin(s.polar) * Math.cos(s.az),
    );
    camera.lookAt(s.target);
  });

  return null;
}

function MachineOnFloor({ machine, placement, focused, dimmed }: { machine: Machine; placement: Placement; focused: boolean; dimmed: boolean }) {
  const { config, reduceMotion } = useConfig();
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const status = machine.current?.status ?? "unknown";
  const modelUrl = useFileUrl(machine.modelUrl);
  const statusColor = config.theme.statusColors[status];
  const targetOpacity = dimmed ? config.animation.factoryFloor.otherMachinesOpacityWhenFocused : 1;

  useFrame((_, dt) => {
    if (spin.current) {
      if (focused && !reduceMotion) spin.current.rotation.y += dt * 0.35;
      else spin.current.rotation.y += (0 - spin.current.rotation.y) * Math.min(1, dt * 3);
    }
    group.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const base = (m.userData.baseOpacity as number | undefined) ?? (m.userData.baseOpacity = m.opacity);
        const goal = base * targetOpacity;
        m.transparent = true;
        m.opacity += (goal - m.opacity) * Math.min(1, dt * 4);
        m.depthWrite = m.opacity > 0.6;
      }
    });
  });

  return (
    <group ref={group} position={[placement.x, 0, placement.z]} rotation={[0, placement.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.55, 1.85, 64]} />
        <meshBasicMaterial color={statusColor} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[1.85, 64]} />
        <meshBasicMaterial color={statusColor} transparent opacity={0.12} />
      </mesh>
      <group ref={spin}>
        <MachineModel
          type={machine.machineType}
          modelUrl={modelUrl}
          colors={{ body: config.theme.factoryFloor.machineBody, accent: config.theme.factoryFloor.machineAccent }}
        />
      </group>
    </group>
  );
}

function Floor({ radius }: { radius: number }) {
  const { config } = useConfig();
  const f = config.theme.factoryFloor;
  const size = radius * 2;
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(size, Math.round(size / 2), f.gridLine, f.gridLine);
    g.position.y = 0.005;
    return g;
  }, [size, f.gridLine]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={f.floor} roughness={0.95} />
      </mesh>
      <primitive object={grid} />
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[size + 0.4, 0.3, size + 0.4]} />
        <meshStandardMaterial color={f.machineAccent} roughness={0.9} />
      </mesh>
    </>
  );
}

export function FactoryFloor({ machines, selectedId }: Props) {
  const { config, reduceMotion } = useConfig();
  const bg = config.theme.palettes[config.theme.mode].background;
  const { placements, radius } = useMemo(() => layoutMachines(machines), [machines]);
  const byId = new Map(machines.map((m) => [m.id, m]));
  const hasSelection = selectedId !== null && byId.has(selectedId);

  return (
    <Canvas
      className="background-layer"
      data-testid="factory-floor"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.75]}
      frameloop={reduceMotion ? "demand" : "always"}
      camera={{ fov: 40, near: 0.1, far: 400, position: [0, 20, 30] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, radius * 1.6, radius * 4.2]} />
      <hemisphereLight args={["#dbe6f3", "#202833", 0.9]} />
      <directionalLight position={[radius, radius * 1.5, radius * 0.6]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-radius, radius, radius, -radius, 0.1, radius * 5]} />
      </directionalLight>
      <Floor radius={radius} />
      {placements.map((p) => {
        const m = byId.get(p.id)!;
        return <MachineOnFloor key={p.id} machine={m} placement={p} focused={p.id === selectedId} dimmed={hasSelection && p.id !== selectedId} />;
      })}
      <CameraRig placements={placements} radius={radius} selectedId={hasSelection ? selectedId : null} />
    </Canvas>
  );
}
