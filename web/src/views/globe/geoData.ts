// Country and state outlines shipped with the app (web/public/geo, built by scripts/build-geo.mjs from
// Natural Earth). They are used to draw the globe and to find the area to zoom to for each factory.
import type { FeatureCollection, Geometry, Position } from "./geojson";

export interface GeoProps {
  name: string;
  iso: string;
  country?: string;
}
export type GeoCollection = FeatureCollection<Geometry, GeoProps>;
export type BBox = [number, number, number, number];

let countriesCache: Promise<GeoCollection> | null = null;
const statesCache = new Map<string, Promise<GeoCollection>>();

function getGeo(file: string): Promise<GeoCollection> {
  return fetch(`${import.meta.env.BASE_URL}geo/${file}`).then((r) => {
    if (!r.ok) throw new Error(`GLOBE-001: could not load geo/${file} (status ${r.status})`);
    return r.json() as Promise<GeoCollection>;
  });
}

/** Country outlines (about 400 KB, loaded once). */
export function loadCountries(): Promise<GeoCollection> {
  countriesCache ??= getGeo("countries.json");
  countriesCache.catch(() => (countriesCache = null));
  return countriesCache;
}

/** State outlines of one country, by ISO code (a few KB to about 80 KB, loaded when the globe flies there). */
export function loadStates(iso: string): Promise<GeoCollection> {
  const key = /^[A-Z]{2}$/.test(iso) ? iso : "XX";
  let p = statesCache.get(key);
  if (!p) {
    p = getGeo(`states/${key}.json`).catch(() => ({ type: "FeatureCollection", features: [] }) as GeoCollection);
    statesCache.set(key, p);
  }
  return p;
}

/** Lowercase, no accents, single spaces: "Nuevo León" and "nuevo leon" match. */
export function normaliseName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states of america",
  us: "united states of america",
  "united states": "united states of america",
  uk: "united kingdom",
  "great britain": "united kingdom",
  uae: "united arab emirates",
  "south korea": "south korea",
  "czech republic": "czechia",
};

export function findCountry(countries: GeoCollection, country: string) {
  const key = normaliseName(country);
  const target = COUNTRY_ALIASES[key] ?? key;
  return countries.features.find(
    (f) => normaliseName(f.properties.name) === target || (f.properties.iso ?? "").toLowerCase() === key,
  );
}

export function findState(states: GeoCollection, state: string) {
  const key = normaliseName(state);
  return states.features.find((f) => normaliseName(f.properties.name) === key);
}

function eachPosition(geometry: Geometry, fn: (p: Position) => void) {
  if (geometry.type === "Polygon") geometry.coordinates.forEach((ring) => ring.forEach(fn));
  else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(fn)));
}

/** Bounding box that also works for countries crossing the 180° line (it picks the narrower of two boxes). */
export function bbox(geometry: Geometry): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minX2 = Infinity, maxX2 = -Infinity;
  eachPosition(geometry, ([x, y]) => {
    const x2 = x! < 0 ? x! + 360 : x!;
    minX = Math.min(minX, x!); maxX = Math.max(maxX, x!);
    minX2 = Math.min(minX2, x2); maxX2 = Math.max(maxX2, x2);
    minY = Math.min(minY, y!); maxY = Math.max(maxY, y!);
  });
  if (maxX2 - minX2 < maxX - minX) {
    return [minX2 > 180 ? minX2 - 360 : minX2, minY, maxX2 > 180 ? maxX2 - 360 : maxX2, maxY];
  }
  return [minX, minY, maxX, maxY];
}
