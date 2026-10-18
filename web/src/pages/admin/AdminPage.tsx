import { useSearchParams } from "react-router-dom";
import { useScene } from "../../state/SceneProvider";
import { AuditTab } from "./AuditTab";
import { FactoriesTab } from "./FactoriesTab";
import { UsersTab } from "./UsersTab";

const TABS = [
  { id: "users", label: "Users", Component: UsersTab },
  { id: "factories", label: "Factories and machines", Component: FactoriesTab },
  { id: "log", label: "Change log", Component: AuditTab },
] as const;

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const current = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  useScene({ kind: "none" });
  return (
    <section className="page-panel" aria-label="Admin">
      <div className="panel-header">
        <h1>Admin</h1>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === current.id} onClick={() => setParams({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        <current.Component />
      </div>
    </section>
  );
}
