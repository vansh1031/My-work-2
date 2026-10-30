// Where each machine stands on the 3D floor. Positions follow a sunflower spiral: it looks natural rather than
// grid-like, works for any number of machines, and gives every machine the same spot on every visit
// (machines are placed in Machine ID order).

export interface Placement {
  id: number;
  x: number;
  z: number;
  /** Rotation around the vertical axis, in radians. Machines face outward with a small fixed tilt. */
  yaw: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const SPACING = 3.4;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function layoutMachines(machines: { id: number; code: string }[]): { placements: Placement[]; radius: number } {
  const sorted = [...machines].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const placements = sorted.map((m, i) => {
    const r = SPACING * Math.sqrt(i + 0.6);
    const a = i * GOLDEN_ANGLE;
    const x = r * Math.sin(a);
    const z = r * Math.cos(a);
    return { id: m.id, x, z, yaw: Math.atan2(x, z) + (hash(m.code) - 0.5) * 0.5 };
  });
  const radius = Math.max(6, ...placements.map((p) => Math.hypot(p.x, p.z))) + 3;
  return { placements, radius };
}
