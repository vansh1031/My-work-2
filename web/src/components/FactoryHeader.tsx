import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { FactorySummary } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";

/** Name, address and the Machines / History / Uploads tabs, shared by every factory screen. */
export function FactoryHeader({ factory }: { factory: FactorySummary }) {
  const { config } = useConfig();
  return (
    <div className="panel-header">
      <Link to={`/?f=${factory.id}`} className="small row" style={{ gap: "0.3rem" }}>
        <ArrowLeft aria-hidden size={14} /> All factories
      </Link>
      <div className="row-between">
        <h1>{factory.name}</h1>
        {factory.isSample && <span className="tag" title="This factory and its data are sample data">Sample</span>}
      </div>
      <div className="muted small">
        {factory.city}, {factory.state}, {factory.country} &middot; {factory.shiftsPerDay} shifts per day
      </div>
      <nav className="tabs" aria-label="Factory sections">
        <NavLink to={`/factories/${factory.id}`} end>Machines</NavLink>
        {config.app.features.history && <NavLink to={`/factories/${factory.id}/history`}>History</NavLink>}
        <NavLink to={`/factories/${factory.id}/uploads`}>Uploads</NavLink>
      </nav>
    </div>
  );
}
