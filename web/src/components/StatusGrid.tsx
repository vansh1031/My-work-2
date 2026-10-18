import type { StatusRecord } from "@fa/shared";
import { formatShortDate } from "../lib/format";
import { useStatusLabel } from "./StatusBadge";

/** Coloured squares: one row per machine and shift, one column per day. Hover a square for the details. */
export function StatusGrid({
  rows,
  days,
  records,
}: {
  rows: { key: string; label: string; machineId: number; shift: number }[];
  days: string[];
  records: StatusRecord[];
}) {
  const label = useStatusLabel();
  const byKey = new Map(records.map((r) => [`${r.machineId}:${r.shift}:${r.workDate}`, r]));
  return (
    <div className="table-wrap">
      <table className="hgrid">
        <thead>
          <tr>
            <th>Machine / shift</th>
            {days.map((d) => (
              <th key={d} className="day">{formatShortDate(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td style={{ whiteSpace: "nowrap" }}>{row.label}</td>
              {days.map((d) => {
                const r = byKey.get(`${row.machineId}:${row.shift}:${d}`);
                const status = r?.status ?? "unknown";
                const title = r
                  ? `${formatShortDate(d)}, shift ${row.shift}: ${label(status)}${r.abortCount ? `, aborted ${r.abortCount} times` : ""}${r.remarks ? `. ${r.remarks}` : ""} (${r.source === "manual" ? "edited by" : "uploaded by"} ${r.createdBy})`
                  : `${formatShortDate(d)}, shift ${row.shift}: no data`;
                return (
                  <td key={d} className="cell" title={title}>
                    <span style={{ background: r ? `var(--status-${status})` : "transparent", opacity: r ? 0.85 : 1 }} aria-label={title} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
