// The map style for the globe. "Built-in" draws the shipped country outlines in the theme colours and works without
// map tiles. State outlines are added per country, only for the country the globe flies to (fa-states). When online tiles are on (config/app.json map.useOnlineTiles), the online style is used
// as the base and the same factory and highlight layers are added on top.
import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { PublicConfig } from "@fa/shared";
import type { GeoCollection } from "./geoData";

const EMPTY = { type: "FeatureCollection", features: [] } as const;

export function overlaySources(): Record<string, SourceSpecification> {
  return {
    "fa-states": { type: "geojson", data: EMPTY as never },
    "fa-highlight": { type: "geojson", data: EMPTY as never },
    "fa-factories": { type: "geojson", data: EMPTY as never },
  };
}

export function overlayLayers(theme: PublicConfig["theme"]): LayerSpecification[] {
  const g = theme.globe;
  return [
    { id: "fa-states", type: "line", source: "fa-states", minzoom: 2.5, paint: { "line-color": g.stateBorder, "line-width": 0.8 } },
    { id: "fa-highlight-fill", type: "fill", source: "fa-highlight", paint: { "fill-color": g.highlightFill, "fill-opacity": g.highlightFillOpacity } },
    { id: "fa-highlight-line", type: "line", source: "fa-highlight", paint: { "line-color": g.highlightBorder, "line-width": 1.5 } },
    {
      id: "fa-factories",
      type: "circle",
      source: "fa-factories",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 8, 7],
        "circle-color": g.marker,
        "circle-stroke-color": g.markerRing,
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.85,
      },
    },
  ];
}

/** Soft glow around the globe at low zoom, fading out as the camera gets close. */
function atmosphere(theme: PublicConfig["theme"]): StyleSpecification["sky"] {
  return {
    "sky-color": theme.palettes[theme.mode].background,
    "horizon-color": theme.globe.highlightBorder,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 4, 0.5, 7, 0],
  };
}

export function builtInStyle(theme: PublicConfig["theme"], countries: GeoCollection): StyleSpecification {
  const g = theme.globe;
  return {
    version: 8,
    projection: { type: "globe" },
    sky: atmosphere(theme),
    sources: {
      countries: { type: "geojson", data: countries as never },
      ...overlaySources(),
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": g.ocean } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": g.land } },
      { id: "country-borders", type: "line", source: "countries", paint: { "line-color": g.countryBorder, "line-width": 0.8 } },
      ...overlayLayers(theme),
    ],
  };
}

/** Loads the online style. Gives up after a few seconds so a slow or blocked network falls back to the built-in style. */
export async function onlineStyle(url: string, theme: PublicConfig["theme"], timeoutMs = 4000): Promise<StyleSpecification> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const style = (await res.json()) as StyleSpecification;
    return {
      ...style,
      projection: { type: "globe" },
      sky: style.sky ?? atmosphere(theme),
      sources: { ...style.sources, ...overlaySources() },
      layers: [...style.layers, ...overlayLayers(theme)],
    };
  } finally {
    clearTimeout(timer);
  }
}
