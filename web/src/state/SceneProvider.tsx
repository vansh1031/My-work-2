// What the background should show. Pages describe the scene (globe with a selected factory, or the 3D factory
// floor with a selected machine); BackgroundLayer reads it and draws. Pages never touch the 3D code directly.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FactorySummary, Machine } from "@fa/shared";

export type Scene =
  | { kind: "none" }
  | { kind: "globe"; factories: FactorySummary[]; selectedId: number | null }
  | { kind: "floor"; factoryId: number; machines: Machine[]; selectedId: number | null };

interface SceneValue {
  scene: Scene;
  setScene(scene: Scene): void;
  /** True while the camera is flying. The background is shown a little brighter during that time. */
  moving: boolean;
  setMoving(moving: boolean): void;
  /** The last thing the background reported, shown in the debug panel. */
  debugInfo: Record<string, unknown>;
  setDebugInfo(info: Record<string, unknown>): void;
}

const SceneContext = createContext<SceneValue | null>(null);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<Scene>({ kind: "none" });
  const [moving, setMoving] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({});
  const value = useMemo(() => ({ scene, setScene, moving, setMoving, debugInfo, setDebugInfo }), [scene, moving, debugInfo]);
  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

export function useSceneState(): SceneValue {
  const value = useContext(SceneContext);
  if (!value) throw new Error("useSceneState must be used inside SceneProvider");
  return value;
}

/** Pages call this to say what the background should show while they are open. */
export function useScene(scene: Scene) {
  const { setScene } = useSceneState();
  const key = JSON.stringify(scene, (k, v) => (k === "statusCounts" || k === "description" ? undefined : v));
  useEffect(() => {
    setScene(scene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setScene]);
}
