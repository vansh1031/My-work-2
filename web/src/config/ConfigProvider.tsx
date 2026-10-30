// Loads the client config from the server (GET /api/config) before anything else is shown, then applies the theme
// as CSS variables, sets the window title and favicon. If the server cannot be reached, shows ConnectionScreen.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PublicConfig } from "@fa/shared";
import { api, ApiError } from "../lib/api";
import { fileUrl } from "../lib/fileUrl";
import { ConnectionScreen } from "../components/ConnectionScreen";

interface ConfigValue {
  config: PublicConfig;
  reduceMotion: boolean;
}

const ConfigContext = createContext<ConfigValue | null>(null);

export function useConfig(): ConfigValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useConfig must be used inside ConfigProvider");
  return value;
}

function applyTheme(config: PublicConfig) {
  const { theme } = config;
  const p = theme.palettes[theme.mode];
  const root = document.documentElement.style;
  const vars: Record<string, string> = {
    "--bg": p.background,
    "--surface": p.surface,
    "--surface-raised": p.surfaceRaised,
    "--border": p.border,
    "--text": p.text,
    "--text-muted": p.textMuted,
    "--accent": p.accent,
    "--accent-text": p.accentText,
    "--danger": p.danger,
    "--focus": p.focus,
    "--radius": `${theme.cornerRadiusPx}px`,
    "--panel-opacity": String(theme.panelOpacity),
    "--font": theme.fontFamily,
    "--marker": theme.globe.marker,
    "--marker-ring": theme.globe.markerRing,
  };
  for (const [status, color] of Object.entries(theme.statusColors)) vars[`--status-${status}`] = color;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  root.setProperty("color-scheme", theme.mode);
  document.title = config.branding.appTitle;
  const icon = document.getElementById("favicon") as HTMLLinkElement | null;
  if (icon) fileUrl("/api/brand/favicon").then((url) => (icon.href = url), () => undefined);
}

function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Shown while the app starts. The first start in browser mode prepares the built-in database, which takes a few seconds. */
function Starting() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="login-wrap" role="status">
      <div className="row muted">
        <div className="spinner" /> Starting
      </div>
    </div>
  );
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const systemReduced = useSystemReducedMotion();

  const load = useCallback(() => {
    setError(null);
    api
      .get<PublicConfig>("/api/config")
      .then((c) => {
        applyTheme(c);
        setConfig(c);
      })
      .catch((e: ApiError) => setError(e));
  }, []);

  useEffect(load, [load]);

  if (error) return <ConnectionScreen error={error} onRetry={load} />;
  if (!config) return <Starting />;

  const reduceMotion = config.animation.reduceMotion || (config.animation.followSystemReduceMotion && systemReduced);
  return <ConfigContext.Provider value={{ config, reduceMotion }}>{children}</ConfigContext.Provider>;
}
