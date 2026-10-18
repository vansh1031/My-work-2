// The four machine statuses. Order matters: it is the display order in filters and legends.
export const MACHINE_STATUSES = ["running", "stopped", "aborted", "shift_ended"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export function isMachineStatus(value: unknown): value is MachineStatus {
  return typeof value === "string" && (MACHINE_STATUSES as readonly string[]).includes(value);
}
