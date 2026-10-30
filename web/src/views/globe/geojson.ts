// Minimal GeoJSON types, enough for the boundary files.
export type Position = number[];
export type Geometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] }
  | { type: "Point"; coordinates: Position };
export interface Feature<G = Geometry, P = Record<string, unknown>> {
  type: "Feature";
  geometry: G;
  properties: P;
}
export interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}
