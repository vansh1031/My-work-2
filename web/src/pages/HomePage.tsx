// Home: the overall picture at the top, the factories this user may see on the left, the globe on the right.
// Clicking a factory (or its pin on the globe) shows it on the globe. "Open" goes into the factory.
import { lazy, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Factory, Search, X } from "lucide-react";
import type { FactorySummary } from "@fa/shared";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { useFactories } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryPhoto } from "../components/PhotoPlaceholder";
import { StatusSummary } from "../components/StatusSummary";
import { addCounts, Summary } from "../components/Summary";
import { ViewPanel } from "../components/ViewPanel";

const GlobeView = lazy(() => import("../views/globe/GlobeView").then((m) => ({ default: m.GlobeView })));

/** Height kept clear at the bottom of the globe for the selected factory card. */
const CARD_INSET = 110;

function FactoryRow({ factory, selected, onShow, onOpen }: { factory: FactorySummary; selected: boolean; onShow(): void; onOpen(): void }) {
  return (
    <div className="list-row" aria-current={selected} data-testid={`factory-row-${factory.id}`}>
      <FactoryPhoto url={factory.photoUrl} name={factory.name} />
      <button className="row-main" onClick={onShow} aria-label={`Show ${factory.name} on the globe`}>
        <span className="row-between">
          <span className="card-title">{factory.name}</span>
          {factory.isSample && <span className="tag" title="This factory and its data are sample data">Sample</span>}
        </span>
        <span className="card-sub">
          {factory.city}, {factory.state}, {factory.country}
        </span>
        <span className="card-meta">
          <span>{factory.machineCount} machines</span>
          <StatusSummary counts={factory.statusCounts} />
        </span>
      </button>
      <button className="btn btn-sm" onClick={onOpen} aria-label={`Open ${factory.name}`}>
        Open <ArrowRight aria-hidden />
      </button>
    </div>
  );
}

export function HomePage() {
  const { config } = useConfig();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: factories = [], isLoading, error } = useFactories();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");

  const selectedId = Number(params.get("f")) || null;
  const select = (id: number | null) => setParams(id ? { f: String(id) } : {}, { replace: true });
  const open = (id: number) => navigate(`/factories/${id}`);
  const selected = factories.find((f) => f.id === selectedId) ?? null;

  const countries = useMemo(() => [...new Set(factories.map((f) => f.country))].sort(), [factories]);
  const states = useMemo(
    () => [...new Set(factories.filter((f) => !country || f.country === country).map((f) => f.state))].sort(),
    [factories, country],
  );
  const q = query.trim().toLowerCase();
  const visible = factories.filter(
    (f) =>
      (!country || f.country === country) &&
      (!state || f.state === state) &&
      (!q || [f.name, f.city, f.state, f.country].some((v) => v.toLowerCase().includes(q))),
  );
  const showSearch = factories.length > config.app.showSearchWhenMoreThan;
  const totals = addCounts(factories.map((f) => f.statusCounts));

  return (
    <div className="page">
      <header className="page-header">
        <div className="title-row">
          <h1>Factories</h1>
        </div>
        <Summary
          counts={totals}
          totals={[
            { label: "Factories", value: factories.length },
            { label: "Machines", value: factories.reduce((n, f) => n + f.machineCount, 0) },
          ]}
        />
      </header>

      <div className={config.app.features.globe ? "split" : "column"} style={config.app.features.globe ? undefined : { flex: 1, minHeight: 0 }}>
        <section className="panel" aria-label="Factory list">
          {showSearch && (
            <div className="panel-header">
              <div className="search">
                <Search aria-hidden />
                <input className="input" type="search" placeholder="Search by name, city, state or country" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search factories" />
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <select className="input" value={country} onChange={(e) => { setCountry(e.target.value); setState(""); }} aria-label="Filter by country">
                  <option value="">All countries</option>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className="input" value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
                  <option value="">All states</option>
                  {states.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="panel-body">
            {error && <ErrorNotice error={error} />}
            {isLoading && <div className="empty"><div className="spinner" /></div>}
            {!isLoading && factories.length === 0 && (
              <div className="empty">
                <Factory aria-hidden />
                {user?.role === "admin" ? (
                  <span>No factories yet. Add the first one under Admin, Factories and machines.</span>
                ) : (
                  <span>No factories are assigned to you yet. Ask your administrator for access.</span>
                )}
              </div>
            )}
            {factories.length > 0 && visible.length === 0 && <div className="empty">No factories match the search.</div>}
            {visible.map((f) => (
              <FactoryRow key={f.id} factory={f} selected={f.id === selectedId} onShow={() => select(f.id)} onOpen={() => open(f.id)} />
            ))}
          </div>
        </section>

        {config.app.features.globe ? (
          <ViewPanel
            label="Globe"
            hint={selected ? undefined : "Choose a factory to see where it is"}
            overlay={
              selected && (
                <div className="map-card" data-testid="selected-factory">
                  <FactoryPhoto url={selected.photoUrl} name={selected.name} />
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title">{selected.name}</div>
                    <div className="card-sub">{selected.city}, {selected.state}, {selected.country}</div>
                    <div className="card-meta">
                      <span>{selected.machineCount} machines</span>
                      <StatusSummary counts={selected.statusCounts} />
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="btn btn-primary" onClick={() => open(selected.id)}>
                      Open factory <ArrowRight aria-hidden />
                    </button>
                    <button className="btn btn-ghost" onClick={() => select(null)} aria-label="Clear selection">
                      <X aria-hidden />
                    </button>
                  </div>
                </div>
              )
            }
          >
            {(fail) => <GlobeView factories={factories} selectedId={selectedId} onPick={select} bottomInset={selected ? CARD_INSET : 0} onFail={fail} />}
          </ViewPanel>
        ) : null}
      </div>
    </div>
  );
}
