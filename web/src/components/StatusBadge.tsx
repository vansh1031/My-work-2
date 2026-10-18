import type { MachineStatus } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";

type StatusOrUnknown = MachineStatus | "unknown";

/** Coloured dot plus the word. The word is always shown, so the status never relies on colour alone. */
export function StatusBadge({ status, label }: { status: StatusOrUnknown | null | undefined; label?: string }) {
  const { config } = useConfig();
  const s = status ?? "unknown";
  return (
    <span className="status" data-status={s}>
      <span className="status-dot" style={{ background: `var(--status-${s})`, color: `var(--status-${s})` }} aria-hidden />
      {label ?? config.app.statusLabels[s]}
    </span>
  );
}

export function useStatusLabel() {
  const { config } = useConfig();
  return (s: StatusOrUnknown | null | undefined) => config.app.statusLabels[s ?? "unknown"];
}
