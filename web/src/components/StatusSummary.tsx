import { MACHINE_STATUSES, type StatusCounts } from "@fa/shared";
import { StatusBadge } from "./StatusBadge";

/** "3 Running, 1 Aborted ..." for a factory card. Statuses with zero machines are left out. */
export function StatusSummary({ counts }: { counts: StatusCounts }) {
  const parts = [...MACHINE_STATUSES, "unknown" as const].filter((s) => counts[s] > 0);
  if (parts.length === 0) return null;
  return (
    <span className="row" style={{ gap: "0.7rem" }}>
      {parts.map((s) => (
        <span key={s} className="mono">
          <StatusBadge status={s} label={`${counts[s]}`} />
        </span>
      ))}
    </span>
  );
}
