// The globe on the home page. It sits in its own panel (not behind other things), so people can also drag and zoom it.
// Start-up is quick: the country outlines and the online map style are fetched at the same time, and state outlines
// are only fetched for the country the globe flies to. See docs/decisions.md D-037.
import { useEffect, useRef, useState } from "react";
import { AttributionControl, Map as MapLibreMap, NavigationControl, setWorkerUrl, type ErrorEvent, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre does its heavy work in a background worker. The build copies that file next to the app and this tells
// MapLibre where it is (its own guess does not survive bundling or the desktop app).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { FactorySummary } from "@fa/shared";
import { useConfig } from "../../config/ConfigProvider";
import { setDebugInfo } from "../../lib/debug";
import { loadCountries } from "./geoData";
import { GlobeDirector } from "./globeDirector";
import { atmosphere, builtInStyle, onlineStyle } from "./globeStyle";

setWorkerUrl(new URL(workerUrl, window.location.href).href);

interface Props {
  factories: FactorySummary[];
  selectedId: number | null;
  /** A pin on the globe was clicked. */
  onPick(factoryId: number): void;
  /** Pixels to keep clear at the bottom of the panel (the selected factory card). */
  bottomInset: number;
  onFail(error: Error): void;
}

export function GlobeView({ factories, selectedId, onPick, bottomInset, onFail }: Props) {
  const { config, reduceMotion } = useConfig();
  const container = useRef<HTMLDivElement>(null);
  const director = useRef<GlobeDirector | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const firstSelection = useRef(true);

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;
    (async () => {
      try {
        const g = config.animation.globe;
        const countries = loadCountries();
        let style: StyleSpecification;
        let styleSource = "built-in";
        try {
          if (!config.app.map.useOnlineTiles || !config.app.map.tileStyleUrl) throw new Error("online tiles switched off");
          style = await onlineStyle(config.app.map.tileStyleUrl, config.theme);
          styleSource = "online";
        } catch (err) {
          if (config.app.map.useOnlineTiles) console.warn("GLOBE-002: online map style not available, using the built-in globe.", err);
          style = builtInStyle(config.theme, await countries);
        }
        if (cancelled || !container.current) return;
        map = new MapLibreMap({
          container: container.current,
          style,
          center: [78, 22],
          zoom: g.overviewZoom,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 0,
          // Sharp enough on high-resolution screens without drawing 4 times the pixels.
          pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");
        map.on("error", (e: ErrorEvent) => console.warn("GLOBE-003: map warning", e.error?.message ?? e));
        const loadedCountries = await countries;
        if (!map.loaded()) await new Promise((resolve) => map!.once("load", resolve));
        if (cancelled || !map) return;
        mapRef.current = map;
        const cityZoom = styleSource === "online" ? g.cityZoom : Math.min(g.cityZoom, g.stateZoom + 0.5);
        director.current = new GlobeDirector(
          map,
          loadedCountries,
          g,
          reduceMotion,
          {
            onStage: (info) => setDebugInfo("globe", { ...info, style: styleSource }),
            onPick: (id) => pickRef.current(id),
          },
          cityZoom,
          () => ({ top: 30, left: 30, right: 30, bottom: insetRef.current + 30 }),
        );
        setDebugInfo("globe", { stage: "loaded", style: styleSource });
        setReady(true);
      } catch (err) {
        if (!cancelled) onFail(err as Error);
      }
    })();
    return () => {
      cancelled = true;
      director.current?.destroy();
      director.current = null;
      mapRef.current = null;
      map?.remove();
    };
    // The map is built once per visit to the page; config does not change while the app runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light or dark switched while the globe is open: only the glow around the globe uses the page colour.
  useEffect(() => {
    if (ready) mapRef.current?.setSky(atmosphere(config.theme) ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, config.theme.mode]);

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
  return <div ref={container} data-testid="globe" className="map-canvas" style={{ position: "absolute", inset: 0 }} />;
}
