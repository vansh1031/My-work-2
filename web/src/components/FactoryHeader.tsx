import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { FactorySummary } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { Summary } from "./Summary";

/** Breadcrumb, name, address, the factory's status numbers and the Machines / History / Uploads tabs. */
export function FactoryHeader({ factory, machineName }: { factory: FactorySummary; machineName?: string }) {
  const { config } = useConfig();
  const onMachine = useLocation().pathname.includes("/machines/");
  return (
    <header className="page-header">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to={`/?f=${factory.id}`}>Factories</Link>
        <ChevronRight size={14} aria-hidden />
        {machineName ? <Link to={`/factories/${factory.id}`}>{factory.name}</Link> : <span aria-current="page">{factory.name}</span>}
        {machineName && (
          <>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page">{machineName}</span>
          </>
        )}
      </nav>
      <div className="title-row">
        <div>
          <h1>
            {factory.name}
            {factory.isSample && <span className="tag" title="This factory and its data are sample data">Sample</span>}
          </h1>
          <div className="muted small">
            {factory.city}, {factory.state}, {factory.country} &middot; {factory.machineCount} machines &middot; {factory.shiftsPerDay} shifts per day
          </div>
        </div>
      </div>
      <Summary counts={factory.statusCounts} />
      <nav className="tabs tabs-page" aria-label="Factory sections">
        <NavLink to={`/factories/${factory.id}`} end className={({ isActive }) => (isActive || onMachine ? "active" : "")}>
          Machines
        </NavLink>
        {config.app.features.history && <NavLink to={`/factories/${factory.id}/history`}>History</NavLink>}
        <NavLink to={`/factories/${factory.id}/uploads`}>Uploads</NavLink>
      </nav>
    </header>
  );
}
