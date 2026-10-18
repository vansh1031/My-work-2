// 3D shapes for machines. Until the admin uploads a real model (.glb) for a machine, a simple placeholder is drawn
// from basic shapes, picked by the machine type: cnc, lathe, press, injection, robot, conveyor, anything else = generic.
import { Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ErrorBoundary } from "../../components/ErrorBoundary";

interface Colors {
  body: string;
  accent: string;
}

function B({ p, s, c, r }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.6} metalness={0.35} />
    </mesh>
  );
}

function C({ p, r, h, c, rot }: { p: [number, number, number]; r: number; h: number; c: string; rot?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 24]} />
      <meshStandardMaterial color={c} roughness={0.5} metalness={0.5} />
    </mesh>
  );
}

const Z90: [number, number, number] = [0, 0, Math.PI / 2];
const DARK = "#1b222b";

const PLACEHOLDERS: Record<string, (c: Colors) => ReactNode> = {
  cnc: ({ body, accent }) => (
    <>
      <B p={[0, 0.9, 0]} s={[2, 1.8, 1.6]} c={body} />
      <B p={[0, 1.85, 0]} s={[2.1, 0.12, 1.7]} c={accent} />
      <B p={[-0.2, 1.05, 0.81]} s={[1.1, 0.75, 0.03]} c={DARK} />
      <B p={[0.85, 1.15, 0.85]} s={[0.35, 0.55, 0.12]} c={accent} />
    </>
  ),
  lathe: ({ body, accent }) => (
    <>
      <B p={[0, 0.45, 0]} s={[2.8, 0.9, 0.9]} c={body} />
      <B p={[-1.05, 1.25, 0]} s={[0.7, 0.7, 0.85]} c={accent} />
      <C p={[-0.6, 1.2, 0]} r={0.3} h={0.2} c={body} rot={Z90} />
      <C p={[0.1, 1.2, 0]} r={0.07} h={1.2} c={body} rot={Z90} />
      <B p={[1.05, 1.15, 0]} s={[0.4, 0.5, 0.6]} c={accent} />
    </>
  ),
  press: ({ body, accent }) => (
    <>
      <B p={[0, 0.25, 0]} s={[1.9, 0.5, 1.4]} c={accent} />
      <B p={[-0.75, 1.4, 0]} s={[0.3, 2.3, 0.35]} c={body} />
      <B p={[0.75, 1.4, 0]} s={[0.3, 2.3, 0.35]} c={body} />
      <B p={[0, 2.7, 0]} s={[1.95, 0.5, 1.4]} c={accent} />
      <B p={[0, 1.7, 0]} s={[1.1, 0.4, 0.9]} c={body} />
      <C p={[0, 3.2, 0]} r={0.3} h={0.5} c={body} />
    </>
  ),
  injection: ({ body, accent }) => (
    <>
      <B p={[0, 0.35, 0]} s={[3.1, 0.7, 0.9]} c={body} />
      <B p={[-1.0, 1.15, 0]} s={[1.0, 0.95, 0.95]} c={accent} />
      <C p={[0.55, 1.0, 0]} r={0.18} h={1.7} c={body} rot={Z90} />
      <mesh position={[0.9, 1.5, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.32, 0.55, 20]} />
        <meshStandardMaterial color={accent} roughness={0.6} metalness={0.3} />
      </mesh>
    </>
  ),
  robot: ({ body, accent }) => (
    <>
      <B p={[0, 0.03, 0]} s={[2.4, 0.06, 2.4]} c={accent} />
      <C p={[0, 0.25, 0]} r={0.45} h={0.4} c={body} />
      <C p={[0, 0.6, 0]} r={0.3} h={0.35} c={accent} />
      <B p={[0.25, 1.15, 0]} s={[0.24, 1.1, 0.24]} c={body} r={[0, 0, -0.45]} />
      <B p={[0.85, 1.6, 0]} s={[0.9, 0.2, 0.2]} c={body} r={[0, 0, -0.25]} />
      <C p={[1.3, 1.45, 0]} r={0.08} h={0.3} c={accent} />
    </>
  ),
  conveyor: ({ body, accent }) => (
    <>
      <B p={[0, 0.75, 0]} s={[3.4, 0.12, 0.85]} c={DARK} />
      {[-1.5, 1.5].flatMap((x) => [-0.35, 0.35].map((z) => <B key={`${x}${z}`} p={[x, 0.35, z]} s={[0.1, 0.7, 0.1]} c={body} />))}
      {[-1.3, -0.4, 0.5, 1.3].map((x) => (
        <B key={x} p={[x, 0.98, 0]} s={[0.45, 0.35, 0.45]} c={accent} />
      ))}
    </>
  ),
  generic: ({ body, accent }) => (
    <>
      <B p={[0, 0.7, 0]} s={[1.6, 1.4, 1.2]} c={body} />
      <B p={[0, 1.45, 0]} s={[1.7, 0.1, 1.3]} c={accent} />
      <B p={[0.4, 0.9, 0.61]} s={[0.4, 0.5, 0.03]} c={DARK} />
    </>
  ),
};

/** Shown when a machine has an uploaded .glb model. The model is scaled to fit the same space as the placeholder. */
function UploadedModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const object = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      }
    });
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.6 / Math.max(size.x, size.y, size.z, 0.001);
    copy.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    copy.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return copy;
  }, [gltf]);
  return <primitive object={object} />;
}

export function MachineModel({ type, modelUrl, colors }: { type: string; modelUrl: string | null; colors: Colors }) {
  const placeholder = (PLACEHOLDERS[type] ?? PLACEHOLDERS.generic!)(colors);
  if (!modelUrl) return <>{placeholder}</>;
  return (
    <ErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <UploadedModel url={modelUrl} />
      </Suspense>
    </ErrorBoundary>
  );
}

export const MACHINE_TYPES = ["cnc", "lathe", "press", "injection", "robot", "conveyor", "generic"] as const;
