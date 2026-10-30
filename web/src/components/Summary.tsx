import { MACHINE_STATUSES, type StatusCounts } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";

/** The overall picture: real counts per status, plus optional totals in front (for example "Factories 6"). */
export function Summary({ counts, totals = [] }: { counts: StatusCounts; totals?: { label: string; value: number }[] }) {
  const { config } = useConfig();
  const statuses = [...MACHINE_STATUSES, "unknown" as const].filter((s) => s !== "unknown" || counts.unknown > 0);
  return (
    <div className="summary" role="list" aria-label="Summary">
      {totals.map((t) => (
        <div className="stat" role="listitem" key={t.label}>
          <span className="stat-label">{t.label}</span>
          <span className="stat-value">{t.value}</span>
        </div>
      ))}
      {statuses.map((s) => (
        <div className="stat" role="listitem" key={s} data-status={s}>
          <span className="stat-label">
            <span className="status-dot" style={{ background: `var(--status-${s})`, color: `var(--status-${s})` }} aria-hidden />
            {config.app.statusLabels[s]}
          </span>
          <span className="stat-value">{counts[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function addCounts(list: StatusCounts[]): StatusCounts {
  const total: StatusCounts = { running: 0, stopped: 0, aborted: 0, shift_ended: 0, unknown: 0 };
  for (const c of list) for (const k of Object.keys(total) as (keyof StatusCounts)[]) total[k] += c[k];
  return total;
}
