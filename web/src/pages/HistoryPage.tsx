// History tab: every machine and shift for a chosen date range, plus totals per machine.
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MACHINE_STATUSES } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { addDays, daysBetween, todayIso } from "../lib/format";
import { useFactory, useHistory } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryHeader } from "../components/FactoryHeader";
import { StatusBadge } from "../components/StatusBadge";
import { StatusGrid } from "../components/StatusGrid";
import { useScene } from "../state/SceneProvider";

export function HistoryPage() {
  const id = Number(useParams().factoryId);
  const { config } = useConfig();
  const factoryQ = useFactory(id);
  const [to, setTo] = useState(todayIso());
  const [from, setFrom] = useState(addDays(todayIso(), -13));
  const [machineId, setMachineId] = useState<number | "">("");
  const historyQ = useHistory(id, from, to, machineId || undefined);
  useScene(factoryQ.data ? { kind: "floor", factoryId: id, machines: factoryQ.data.machines, selectedId: machineId || null } : { kind: "none" });

  const factory = factoryQ.data;
  const days = useMemo(() => (from <= to ? daysBetween(from, to) : []), [from, to]);
  const machines = (factory?.machines ?? []).filter((m) => !machineId || m.id === machineId);
  const records = historyQ.data?.records ?? [];
  const rows = machines.flatMap((m) =>
    Array.from({ length: factory!.shiftsPerDay }, (_, i) => ({ key: `${m.id}:${i + 1}`, label: `${m.code} shift ${i + 1}`, machineId: m.id, shift: i + 1 })),
  );

  const totals = machines.map((m) => {
    const mine = records.filter((r) => r.machineId === m.id);
    const counts = Object.fromEntries(MACHINE_STATUSES.map((s) => [s, mine.filter((r) => r.status === s).length])) as Record<string, number>;
    return { machine: m, counts, aborts: mine.reduce((n, r) => n + r.abortCount, 0), recorded: mine.length };
  });

  return (
    <section className="page-panel" aria-label="History">
      {factory && <FactoryHeader factory={factory} />}
      <div className="panel-body">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="h-from">From</label>
            <input id="h-from" className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="h-to">To</label>
            <input id="h-to" className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="h-machine">Machine</label>
            <select id="h-machine" className="input" value={machineId} onChange={(e) => setMachineId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All machines</option>
              {factory?.machines.map((m) => <option key={m.id} value={m.id}>{m.code} {m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="legend">
          {[...MACHINE_STATUSES].map((s) => <StatusBadge key={s} status={s} />)}
          <span className="muted">Empty square: no data for that shift</span>
        </div>
        {(historyQ.error || factoryQ.error) && <ErrorNotice error={historyQ.error ?? factoryQ.error} />}
        {historyQ.isLoading && <div className="spinner" />}
        {factory && days.length > 0 && <StatusGrid days={days} rows={rows} records={records} />}

        <div className="section">
          <div className="section-title">Totals for this period</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Machine</th>
                  {MACHINE_STATUSES.map((s) => <th key={s}>{config.app.statusLabels[s]} (shifts)</th>)}
                  <th>Times aborted</th>
                  <th>Shifts with data</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.machine.id}>
                    <td>{t.machine.code} {t.machine.name}</td>
                    {MACHINE_STATUSES.map((s) => <td key={s} className="mono">{t.counts[s]}</td>)}
                    <td className="mono">{t.aborts}</td>
                    <td className="mono">{t.recorded} of {days.length * factory!.shiftsPerDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
