import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, setWorkerUrl, type ErrorEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre does its heavy work in a background worker. The build copies that file next to the app and this tells
// MapLibre where it is (its own guess does not survive bundling or the desktop app).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { FactorySummary } from "@fa/shared";
import { useConfig } from "../../config/ConfigProvider";
import { useSceneState } from "../../state/SceneProvider";
import { loadGeo } from "./geoData";
import { GlobeDirector } from "./globeDirector";
import { builtInStyle, onlineStyle } from "./globeStyle";

setWorkerUrl(new URL(workerUrl, window.location.href).href);

interface Props {
  factories: FactorySummary[];
  selectedId: number | null;
  onFail(error: Error): void;
}

export function GlobeBackground({ factories, selectedId, onFail }: Props) {
  const { config, reduceMotion } = useConfig();
  const { setMoving, setDebugInfo } = useSceneState();
  const container = useRef<HTMLDivElement>(null);
  const director = useRef<GlobeDirector | null>(null);
  const [ready, setReady] = useState(false);
  const firstSelection = useRef(true);

  // Create the map once.
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;
    (async () => {
      try {
        const geo = await loadGeo();
        let style = builtInStyle(config.theme, geo);
        let styleSource = "built-in";
        if (config.app.map.useOnlineTiles && config.app.map.tileStyleUrl) {
          try {
            style = await onlineStyle(config.app.map.tileStyleUrl, config.theme);
            styleSource = "online";
          } catch (err) {
            console.warn("GLOBE-002: online map style not available, using the built-in globe.", err);
          }
        }
        if (cancelled || !container.current) return;
        map = new MapLibreMap({
          container: container.current,
          style,
          center: [78, 22],
          zoom: config.animation.globe.overviewZoom,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        });
        map.on("error", (e: ErrorEvent) => console.warn("GLOBE-003: map warning", e.error?.message ?? e));
        map.once("load", () => {
          if (cancelled || !map) return;
          const g = config.animation.globe;
          const cityZoom = styleSource === "online" ? g.cityZoom : Math.min(g.cityZoom, g.stateZoom + 1.3);
          director.current = new GlobeDirector(map, geo, g, reduceMotion, {
            onMoving: setMoving,
            onStage: (info) => setDebugInfo({ globe: { ...info, style: styleSource } }),
          }, cityZoom);
          director.current.applyPadding();
          setDebugInfo({ globe: { stage: "loaded", style: styleSource } });
          setReady(true);
        });
      } catch (err) {
        if (!cancelled) onFail(err as Error);
      }
    })();
    return () => {
      cancelled = true;
      director.current?.destroy();
      director.current = null;
      setMoving(false);
      map?.remove();
    };
    // The map is built once per visit to the page; config does not change while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) director.current?.setFactories(factories, selectedId);
  }, [ready, factories, selectedId]);

  useEffect(() => {
    const d = director.current;
    if (!ready || !d) return;
    const selected = factories.find((f) => f.id === selectedId) ?? null;
    // Coming back to the home page with a factory already selected: start there, without flying.
    const instant = firstSelection.current;
    firstSelection.current = false;
    if (selected) void d.showFactory(selected, { instant });
    else void d.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  // Inline position: MapLibre's own stylesheet sets position: relative on the map, which would collapse it to zero height.
  return <div ref={container} data-testid="globe" style={{ position: "absolute", inset: 0 }} />;
}
