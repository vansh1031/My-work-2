// System status: what to look at first when something is wrong. Works without signing in.
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { api, DATA_MODE } from "../lib/api";
import { getServerAddress } from "../lib/serverAddress";
import { webglAvailable } from "../views/webgl";
import { AppShell, PublicShell } from "../components/AppShell";
import { ErrorNotice } from "../components/Notice";

interface ServerStatus {
  version: string;
  serverTime: string;
  database: string;
  migrations: string[];
  config: string;
  features: Record<string, boolean>;
  debug: boolean;
}

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={{ color: ok === null ? "var(--text-muted)" : ok ? "var(--status-running)" : "var(--danger)" }}>{ok === null ? "Checking" : ok ? "OK" : "Problem"}</td>
      <td className="small">{detail}</td>
    </tr>
  );
}

export function StatusPage() {
  const { config, reduceMotion } = useConfig();
  const { user } = useAuth();
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tiles, setTiles] = useState<boolean | null>(config.app.map.useOnlineTiles ? null : false);

  useEffect(() => {
    api.get<ServerStatus>("/api/status").then(setServer, setError);
    if (config.app.map.useOnlineTiles) {
      fetch(config.app.map.tileStyleUrl).then((r) => setTiles(r.ok), () => setTiles(false));
    }
  }, [config.app.map]);

  const Shell = user ? AppShell : PublicShell;
  return (
    <Shell>
      <div className="page">
<section className="page-panel" aria-label="System status">
        <div className="panel-header"><h1>System status</h1></div>
        <div className="panel-body">
          <ErrorNotice error={error} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Check</th><th>Result</th><th>Details</th></tr></thead>
              <tbody>
                <Check ok={true} label="App version" detail={__APP_VERSION__} />
                {DATA_MODE === "server" ? (
                  <Check ok={server !== null} label="Server" detail={server ? `Version ${server.version} at ${getServerAddress() || window.location.origin}` : String((error as Error | null)?.message ?? "")} />
                ) : (
                  <Check ok={server !== null} label="Backend" detail={server ? "Built into the app. All data is kept in this browser on this computer." : String((error as Error | null)?.message ?? "")} />
                )}
                <Check ok={server ? server.database === "ok" : null} label="Database" detail={server ? `${server.database}. Applied migrations: ${server.migrations.join(", ")}` : ""} />
                <Check
                  ok={server ? server.config === "ok" : null}
                  label="Configuration files"
                  detail={DATA_MODE === "server" ? "Checked by the server at startup. Run npm run check-config on the server for details." : "Built into the app and checked at startup. Run npm run check-config before building."}
                />
                <Check ok={webglAvailable()} label="3D graphics (WebGL)" detail={webglAvailable() ? "Available. Globe and factory floor can be drawn." : "Not available on this computer. The app works, with a plain background."} />
                <Check
                  ok={config.app.map.useOnlineTiles ? tiles : true}
                  label="Online map tiles"
                  detail={config.app.map.useOnlineTiles ? `${config.app.map.tileStyleUrl}. If this fails, the built-in globe is used instead.` : "Switched off in config/app.json. Using the built-in globe."}
                />
                <Check ok={true} label="Reduce motion" detail={reduceMotion ? "On: animations are skipped." : "Off: animations play."} />
              </tbody>
            </table>
          </div>
          {server && (
            <div className="section">
              <div className="section-title">Features switched on (config/app.json)</div>
              <p className="small">{Object.entries(server.features).map(([k, v]) => `${k}: ${v ? "on" : "off"}`).join(", ")}. Debug panel: {server.debug ? "on" : "off"}.</p>
            </div>
          )}
        </div>
      </section>
      </div>
    </Shell>
  );
}
