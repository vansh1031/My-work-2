// One factory: its machines as cards on the left, the 3D factory floor behind them.
// Clicking a card flies the camera to that machine. "Open machine" shows its details. Clicking empty space zooms back out.
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { MACHINE_STATUSES, type Machine, type MachineStatus } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { formatShortDate } from "../lib/format";
import { useFactory } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryHeader } from "../components/FactoryHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useScene } from "../state/SceneProvider";

function MachineCard({ machine, selected, index, onSelect, onOpen }: { machine: Machine; selected: boolean; index: number; onSelect(): void; onOpen(): void }) {
  const { config, reduceMotion } = useConfig();
  const c = config.animation.cards;
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: c.enterDurationMs / 1000, delay: (index * c.enterStaggerMs) / 1000 }}
    >
      <div
        className="card"
        style={{ gridTemplateColumns: "1fr" }}
        role="button"
        tabIndex={0}
        aria-current={selected}
        data-testid={`machine-card-${machine.code}`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selected) onOpen();
            else onSelect();
          }
        }}
      >
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div className="card-title">{machine.name}</div>
            <div className="card-sub">{machine.code} &middot; {machine.machineType}</div>
          </div>
          <StatusBadge status={machine.current?.status} />
        </div>
        <div className="card-meta">
          {machine.current ? (
            <span>
              {formatShortDate(machine.current.workDate)}, shift {machine.current.shift}
              {machine.current.abortCount > 0 && ` · aborted ${machine.current.abortCount} times`}
            </span>
          ) : (
            <span>No status uploaded yet</span>
          )}
        </div>
        {selected && (
          <div className="card-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              Open machine <ArrowRight aria-hidden />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function FactoryPage() {
  const id = Number(useParams().factoryId);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: factory, error, isLoading } = useFactory(id);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Set<MachineStatus | "unknown">>(new Set());
  const { config } = useConfig();

  const selectedId = Number(params.get("m")) || null;
  const select = (m: number | null) => setParams(m ? { m: String(m) } : {}, { replace: true });
  useScene(factory ? { kind: "floor", factoryId: id, machines: factory.machines, selectedId } : { kind: "none" });

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

  return (
    <div style={{ position: "absolute", inset: 0 }} onClick={(e) => e.target === e.currentTarget && select(null)} onKeyDown={(e) => e.key === "Escape" && select(null)}>
      <section className="side-panel" aria-label="Machines">
        {factory && <FactoryHeader factory={factory} />}
        <div className="panel-body">
          {error && <ErrorNotice error={error} />}
          {isLoading && <div className="empty"><div className="spinner" /></div>}
          {factory && (
            <>
              {factory.machines.length > config.app.showSearchWhenMoreThan && (
                <div className="search">
                  <Search aria-hidden />
                  <input className="input" type="search" placeholder="Search machines" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search machines" />
                </div>
              )}
              <div className="toggle-group" role="group" aria-label="Filter by status">
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
              {factory.machines.length === 0 && <div className="empty">This factory has no machines yet. An administrator can add them under Admin.</div>}
              {factory.machines.length > 0 && machines.length === 0 && <div className="empty">No machines match the filter.</div>}
              {machines.map((m, i) => (
                <MachineCard key={m.id} machine={m} index={i} selected={m.id === selectedId} onSelect={() => select(m.id)} onOpen={() => navigate(`/factories/${id}/machines/${m.id}`)} />
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
