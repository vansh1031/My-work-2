// Home: the factories this user may see, as cards on the left. Behind them, the globe.
// Clicking a card flies the globe to that factory. "View factory" then opens it. Clicking empty space clears the selection.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Factory, Search } from "lucide-react";
import type { FactorySummary } from "@fa/shared";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { useFactories } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryPhoto } from "../components/PhotoPlaceholder";
import { StatusSummary } from "../components/StatusSummary";
import { useScene } from "../state/SceneProvider";

function FactoryCard({ factory, selected, index, onSelect, onOpen }: { factory: FactorySummary; selected: boolean; index: number; onSelect(): void; onOpen(): void }) {
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
        role="button"
        tabIndex={0}
        aria-current={selected}
        data-testid={`factory-card-${factory.id}`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selected) onOpen();
            else onSelect();
          }
        }}
      >
        <FactoryPhoto url={factory.photoUrl} name={factory.name} />
        <div style={{ minWidth: 0 }}>
          <div className="row-between">
            <span className="card-title">{factory.name}</span>
            {factory.isSample && <span className="tag" title="This factory and its data are sample data">Sample</span>}
          </div>
          <div className="card-sub">
            {factory.city}, {factory.state}
          </div>
          <div className="card-sub small">{factory.country}</div>
          <div className="card-meta">
            <span>{factory.machineCount} machines</span>
            <StatusSummary counts={factory.statusCounts} />
          </div>
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
              View factory <ArrowRight aria-hidden />
            </button>
          </div>
        )}
      </div>
    </motion.div>
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

  useScene({ kind: "globe", factories, selectedId });

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

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onClick={(e) => e.target === e.currentTarget && select(null)}
      onKeyDown={(e) => e.key === "Escape" && select(null)}
    >
      <section className="side-panel" aria-label="Factories">
        <div className="panel-header">
          <div className="row-between">
            <h1>Factories</h1>
            <span className="muted small">{factories.length} total</span>
          </div>
          {showSearch && (
            <>
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
            </>
          )}
        </div>
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
          {visible.map((f, i) => (
            <FactoryCard key={f.id} factory={f} index={i} selected={f.id === selectedId} onSelect={() => select(f.id)} onOpen={() => navigate(`/factories/${f.id}`)} />
          ))}
        </div>
      </section>
    </div>
  );
}
