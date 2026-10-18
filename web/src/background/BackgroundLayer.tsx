// Draws whatever the current page asked for (see state/SceneProvider): the globe, the 3D factory floor, or nothing.
// It sits behind everything, is dimmed so the cards stay readable, and brightens a little while the camera moves.
// If WebGL is not available or something fails, it falls back to the plain background colour and the app keeps working.
import { lazy, Suspense, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConfig } from "../config/ConfigProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useSceneState } from "../state/SceneProvider";

const GlobeBackground = lazy(() => import("./globe/GlobeBackground").then((m) => ({ default: m.GlobeBackground })));
const FactoryFloor = lazy(() => import("./floor/FactoryFloor").then((m) => ({ default: m.FactoryFloor })));

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function BackgroundLayer() {
  const { config, reduceMotion } = useConfig();
  const { scene, moving, setDebugInfo } = useSceneState();
  const [failed, setFailed] = useState<string | null>(null);
  const [hasWebgl] = useState(webglAvailable);
  const bg = config.theme.background;
  const features = config.app.features;

  const fail = useCallback(
    (err: Error) => {
      console.error("BG-001: background could not be drawn", err);
      setFailed(err.message);
      setDebugInfo({ background: `failed: ${err.message}` });
    },
    [setDebugInfo],
  );

  let content = null;
  let key = "none";
  if (hasWebgl && !failed) {
    if (scene.kind === "globe" && features.globe) {
      key = "globe";
      content = <GlobeBackground factories={scene.factories} selectedId={scene.selectedId} onFail={fail} />;
    } else if (scene.kind === "floor" && features.factoryFloor3d) {
      key = `floor-${scene.factoryId}`;
      content = <FactoryFloor machines={scene.machines} selectedId={scene.selectedId} />;
    }
  }

  return (
    <div className={`background${reduceMotion ? " reduce-motion" : ""}`} aria-hidden data-background={key}>
      <AnimatePresence>
        {content && (
          <motion.div
            key={key}
            className="background-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7 }}
            style={{ filter: bg.blurPx ? `blur(${bg.blurPx}px)` : undefined }}
          >
            <ErrorBoundary fallback={null} onError={fail}>
              <Suspense fallback={null}>{content}</Suspense>
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="background-dim" style={{ opacity: moving ? bg.dimOpacityWhileMoving : bg.dimOpacity }} />
    </div>
  );
}
