// The 3D factory floor in its own panel on the factory page. Clicking a machine in it selects that machine.
// Nothing selected: the camera slowly circles the whole floor. A machine selected: the camera flies to it, the
// other machines fade out and the selected one slowly turns. Switching machines sweeps the camera around the floor
// (config/animation.json factoryFloor.switchSweepDegrees) before closing in.
// Toolbar (idea from Edge Watch's 3D machine view, D-045): machine names on or off, pause the slow turning,
// and "Whole floor" to go back to the overview. Names are plain HTML placed over the canvas each frame
// (drei Html crashed on unmount, D-014).
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Eye, EyeOff, Maximize2, Pause, Play } from "lucide-react";
import * as THREE from "three";
import type { Machine } from "@fa/shared";
import { useConfig } from "../../config/ConfigProvider";
import { useFileUrl } from "../../lib/fileUrl";
import { setDebugInfo } from "../../lib/debug";
import { layoutMachines, type Placement } from "./layout";
import { MachineModel } from "./MachineModels";

interface Props {
  machines: Machine[];
  selectedId: number | null;
  /** A machine was clicked in the 3D view. */
  onPick(machineId: number): void;
  /** "Whole floor" was clicked: clear the selection. */
  onShowAll(): void;
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

function overviewCamera(radius: number, az: number, aspect: number): CameraState {
  // A narrow or tall panel shows less of the floor sideways, so step further back to fit every machine.
  return { az, polar: 0.95, radius: radius * (aspect < 1.2 ? 2.9 : 2.25), target: new THREE.Vector3(0, 0.4, 0) };
}

function focusCamera(p: Placement): CameraState {
  return { az: Math.atan2(p.x, p.z), polar: 1.1, radius: 10, target: new THREE.Vector3(p.x, 1.4, p.z) };
}

function CameraRig({ placements, radius, selectedId, turning }: { placements: Placement[]; radius: number; selectedId: number | null; turning: boolean }) {
  const { config, reduceMotion } = useConfig();
  const anim = config.animation.factoryFloor;
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const state = useRef<CameraState>(overviewCamera(radius, 0.6, aspect));
  const tween = useRef<{ from: CameraState; to: CameraState; sweep: number; bump: number; start: number; duration: number } | null>(null);
  const previous = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = selectedId;
    const placement = placements.find((p) => p.id === selectedId);
    const to = placement ? focusCamera(placement) : overviewCamera(radius, state.current.az, aspect);
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
    setDebugInfo("floor", { selected: selectedId, move: switching ? "switch" : placement ? "focus" : "overview" });
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
      }
    } else if (selectedId === null && !reduceMotion && turning) {
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

function MachineOnFloor({ machine, placement, focused, dimmed, onPick }: { machine: Machine; placement: Placement; focused: boolean; dimmed: boolean; onPick(id: number): void }) {
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
    <group
      ref={group}
      position={[placement.x, 0, placement.z]}
      rotation={[0, placement.yaw, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onPick(machine.id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
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

/** Moves the name tags (plain HTML over the canvas) to stand above each machine, every frame. */
function NameTags({ placements, layer, visible, selectedId }: { placements: Placement[]; layer: MutableRefObject<HTMLDivElement | null>; visible: boolean; selectedId: number | null }) {
  const { camera, size, invalidate } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => invalidate(), [visible, selectedId, invalidate]);
  useFrame(() => {
    const el = layer.current;
    if (!el || !visible) return;
    for (const p of placements) {
      const tag = el.querySelector<HTMLElement>(`[data-machine="${p.id}"]`);
      if (!tag) continue;
      v.set(p.x, 2.9, p.z).project(camera);
      const behind = v.z > 1;
      tag.style.display = behind ? "none" : "";
      tag.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
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

export function FactoryFloor({ machines, selectedId, onPick, onShowAll }: Props) {
  const { config, reduceMotion } = useConfig();
  const bg = config.theme.palettes[config.theme.mode].background;
  const { placements, radius } = useMemo(() => layoutMachines(machines), [machines]);
  const byId = new Map(machines.map((m) => [m.id, m]));
  const hasSelection = selectedId !== null && byId.has(selectedId);
  const [names, setNames] = useState(config.app.showMachineNamesOnFloor);
  const [turning, setTurning] = useState(true);
  const tagLayer = useRef<HTMLDivElement | null>(null);

  return (
    <>
    <Canvas
      className="map-canvas"
      data-testid="factory-floor"
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.5]}
      frameloop={reduceMotion ? "demand" : "always"}
      camera={{ fov: 40, near: 0.1, far: 400, position: [0, 20, 30] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, radius * 1.6, radius * 4.2]} />
      <hemisphereLight args={["#dbe6f3", "#202833", 0.9]} />
      <directionalLight position={[radius, radius * 1.5, radius * 0.6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-radius, radius, radius, -radius, 0.1, radius * 5]} />
      </directionalLight>
      <Floor radius={radius} />
      {placements.map((p) => {
        const m = byId.get(p.id)!;
        return <MachineOnFloor key={p.id} machine={m} placement={p} focused={p.id === selectedId} dimmed={hasSelection && p.id !== selectedId} onPick={onPick} />;
      })}
      <CameraRig placements={placements} radius={radius} selectedId={hasSelection ? selectedId : null} turning={turning} />
      <NameTags placements={placements} layer={tagLayer} visible={names} selectedId={hasSelection ? selectedId : null} />
    </Canvas>
    {names && (
      <div className="floor-tags" ref={tagLayer} aria-hidden>
        {placements.map((p) => {
          const m = byId.get(p.id)!;
          const cls = hasSelection ? (p.id === selectedId ? "floor-tag current" : "floor-tag dim") : "floor-tag";
          return (
            <span key={p.id} data-machine={p.id} className={cls} style={{ ["--tile-status" as string]: `var(--status-${m.current?.status ?? "unknown"})` }}>
              {m.code}
            </span>
          );
        })}
      </div>
    )}
    <div className="view-tools" role="toolbar" aria-label="3D view">
      <button type="button" className="btn btn-sm" aria-pressed={names} onClick={() => setNames((n) => !n)} data-testid="floor-names">
        {names ? <Eye aria-hidden /> : <EyeOff aria-hidden />} Names
      </button>
      {!reduceMotion && !hasSelection && (
        <button type="button" className="btn btn-sm" aria-pressed={!turning} onClick={() => setTurning((t) => !t)}>
          {turning ? <Pause aria-hidden /> : <Play aria-hidden />} {turning ? "Stop turning" : "Turn"}
        </button>
      )}
      {hasSelection && (
        <button type="button" className="btn btn-sm" onClick={onShowAll} data-testid="floor-show-all">
          <Maximize2 aria-hidden /> Whole floor
        </button>
      )}
    </div>
    </>
  );
}
