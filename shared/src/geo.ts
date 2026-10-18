// Geography helpers used by the globe animation. Kept free of any map library so they can be unit tested.

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type FlightKind = "first" | "slide" | "long";

/**
 * Decides how the globe should travel to a factory.
 * - first: nothing was selected before, so do the full country, state, city sequence.
 * - slide: the previous factory is close, so just glide across the map.
 * - long:  the previous factory is far, so zoom out, rotate and zoom back in.
 */
export function planFlight(previous: LatLng | null, next: LatLng, nearDistanceKm: number): FlightKind {
  if (!previous) return "first";
  return distanceKm(previous, next) <= nearDistanceKm ? "slide" : "long";
}
