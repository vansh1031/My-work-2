// One factory: machine tiles on the left; on the right the 3D floor and, when a machine is chosen, its details.
// Clicking a tile (or a machine in 3D) opens its details and flies the camera to it. The address follows the choice
// (/factories/3/machines/12), so a machine can be linked to directly and Back works.
import { lazy, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { MACHINE_STATUSES, type Machine, type MachineStatus } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { formatShortDate } from "../lib/format";
import { useFactory } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryHeader } from "../components/FactoryHeader";
import { MachineDetails } from "../components/MachineDetails";
import { StatusBadge } from "../components/StatusBadge";
import { ViewPanel } from "../components/ViewPanel";

const FactoryFloor = lazy(() => import("../views/floor/FactoryFloor").then((m) => ({ default: m.FactoryFloor })));

function MachineTile({ machine, selected, onSelect }: { machine: Machine; selected: boolean; onSelect(): void }) {
  const { config } = useConfig();
  const status = machine.current?.status ?? "unknown";
  return (
    <button
      className="tile"
      aria-current={selected}
      aria-label={`${machine.name}, ${machine.code}, ${config.app.statusLabels[status]}`}
      data-testid={`machine-tile-${machine.code}`}
      style={{ ["--tile-status" as string]: `var(--status-${status})` }}
      onClick={onSelect}
    >
      <span className="row-between" style={{ alignItems: "flex-start" }}>
        <span className="tile-name">{machine.name}</span>
      </span>
      <span className="tile-sub">{machine.code} &middot; {machine.machineType}</span>
      <StatusBadge status={machine.current?.status} />
      <span className="tile-sub">
        {machine.current ? (
          <>
            {formatShortDate(machine.current.workDate)}, shift {machine.current.shift}
            {machine.current.abortCount > 0 && ` · aborted ${machine.current.abortCount} times`}
          </>
        ) : (
          "No status uploaded yet"
        )}
      </span>
    </button>
  );
}

export function FactoryPage() {
  const params = useParams();
  const id = Number(params.factoryId);
  const selectedId = Number(params.machineId) || null;
  const navigate = useNavigate();
  const { data: factory, error, isLoading } = useFactory(id);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Set<MachineStatus | "unknown">>(new Set());
  const { config } = useConfig();

  const select = (m: number | null) => navigate(m ? `/factories/${id}/machines/${m}` : `/factories/${id}`, { replace: true });
  const selectedMachine = factory?.machines.find((m) => m.id === selectedId);

  const q = query.trim().toLowerCase();
  const machines = (factory?.machines ?? []).filter(
    (m) =>
      (statuses.size === 0 || statuses.has(m.current?.status ?? "unknown")) &&
      (!q || [m.code, m.name, m.machineType].some((v) => v.toLowerCase().includes(q))),
  );
  const toggle = (s: MachineStatus | "unknown") =>
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  if (error) return <div className="page"><ErrorNotice error={error} /></div>;
  if (isLoading || !factory) return <div className="page"><div className="empty"><div className="spinner" /></div></div>;

  const show3d = config.app.features.factoryFloor3d;
  return (
    <div className="page">
      <FactoryHeader factory={factory} machineName={selectedMachine?.name} />
      <div className={show3d || selectedId ? "split split-even" : "column"} style={show3d || selectedId ? undefined : { flex: 1, minHeight: 0 }}>
        <section className="panel" aria-label="Machines">
          <div className="panel-header">
            {factory.machines.length > config.app.showSearchWhenMoreThan && (
              <div className="search">
                <Search aria-hidden />
                <input className="input" type="search" placeholder="Search machines" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search machines" />
              </div>
            )}
            <div className="toggle-group" role="group" aria-label="Show only">
              {[...MACHINE_STATUSES, "unknown" as const].map((s) => {
                const count = factory.statusCounts[s];
                if (count === 0 && !statuses.has(s)) return null;
                return (
                  <button key={s} className="toggle" aria-pressed={statuses.has(s)} onClick={() => toggle(s)}>
                    <StatusBadge status={s} label={`${config.app.statusLabels[s]} ${count}`} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="panel-body">
            {factory.machines.length === 0 && <div className="empty">This factory has no machines yet. An administrator can add them under Admin.</div>}
            {factory.machines.length > 0 && machines.length === 0 && <div className="empty">No machines match the filter.</div>}
            <div className="tiles">
              {machines.map((m) => (
                <MachineTile key={m.id} machine={m} selected={m.id === selectedId} onSelect={() => select(m.id === selectedId ? null : m.id)} />
              ))}
            </div>
          </div>
        </section>

        {(show3d || selectedId) && (
          <div className="column">
            {show3d && (
              <ViewPanel label="Factory floor" hint={selectedId ? undefined : "Click a machine here or in the list to see its details"}>
                {() => <FactoryFloor machines={factory.machines} selectedId={selectedId} onPick={(m) => select(m)} onShowAll={() => select(null)} />}
              </ViewPanel>
            )}
            {selectedId && (
              <MachineDetails
                key={selectedId}
                machineId={selectedId}
                machines={factory.machines}
                shiftsPerDay={factory.shiftsPerDay}
                onSelect={(m) => select(m)}
                onClose={() => select(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
