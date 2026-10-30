// Turned on with "debug": true in config/app.json. Shows what the app is doing, without opening any code.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { DATA_MODE, localBackendKind } from "../lib/api";
import { getServerAddress } from "../lib/serverAddress";
import { useSceneState } from "../state/SceneProvider";

const recentErrors: string[] = [];
window.addEventListener("error", (e) => recentErrors.unshift(`${new Date().toLocaleTimeString()} ${e.message}`));
window.addEventListener("unhandledrejection", (e) => recentErrors.unshift(`${new Date().toLocaleTimeString()} ${String(e.reason?.code ?? "")} ${String(e.reason?.message ?? e.reason)}`));

export function DebugPanel() {
  const { config, reduceMotion } = useConfig();
  const { user } = useAuth();
  const { scene, moving, debugInfo } = useSceneState();
  const location = useLocation();
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  if (!config.app.debug) return null;
  const selected = scene.kind === "none" ? null : scene.selectedId;
  return (
    <div className="debug" aria-label="Debug panel">
      <div><b>Version</b> {__APP_VERSION__}</div>
      <div><b>Data mode</b> {DATA_MODE === "browser" ? `browser (built-in backend: ${localBackendKind()})` : "server"}</div>
      {DATA_MODE === "server" && <div><b>Server</b> {getServerAddress() || window.location.origin}</div>}
      <div><b>Screen</b> {location.pathname}</div>
      <div><b>User</b> {user ? `${user.username} (${user.role}${user.canUpdateStatus ? ", can update" : ""})` : "not signed in"}</div>
      <div><b>Background</b> {scene.kind} {selected !== null ? `, selected #${selected}` : ""} {moving ? "(moving)" : ""}</div>
      <div><b>Reduce motion</b> {String(reduceMotion)}</div>
      <div><b>FPS</b> {fps}</div>
      {Object.entries(debugInfo).map(([k, v]) => (
        <div key={k}><b>{k}</b> {typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
      ))}
      <div><b>Recent errors</b></div>
      {recentErrors.slice(0, 6).map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}
