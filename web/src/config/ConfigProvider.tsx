// Loads the client config from the server (GET /api/config) before anything else is shown, then applies the theme
// as CSS variables, sets the window title and favicon. If the server cannot be reached, shows ConnectionScreen.
// Light or dark: config/theme.json "mode" is the default; if "allowUserSwitch" is on, a choice made with the
// top bar button is kept in this browser and wins (D-043).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicConfig } from "@fa/shared";
import { api, ApiError } from "../lib/api";
import { fileUrl } from "../lib/fileUrl";
import { ConnectionScreen } from "../components/ConnectionScreen";

export type ThemeMode = "dark" | "light";

/** The config as the screens see it: theme.mode is always the mode in use right now, never "system". */
export type AppConfig = Omit<PublicConfig, "theme"> & { theme: Omit<PublicConfig["theme"], "mode"> & { mode: ThemeMode } };

interface ConfigValue {
  config: AppConfig;
  reduceMotion: boolean;
  /** Switch light or dark and remember it in this browser. Does nothing if the config does not allow it. */
  setThemeMode(mode: ThemeMode): void;
}

const THEME_KEY = "factory-atlas.theme";

function savedThemeMode(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

const ConfigContext = createContext<ConfigValue | null>(null);

export function useConfig(): ConfigValue {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("useConfig must be used inside ConfigProvider");
  return value;
}

function applyTheme(config: AppConfig) {
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
    "--font": theme.fontFamily,
    "--marker": theme.globe.marker,
    "--marker-ring": theme.globe.markerRing,
  };
  for (const [status, color] of Object.entries(theme.statusColors)) vars[`--status-${status}`] = color;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  root.setProperty("color-scheme", theme.mode);
  document.documentElement.dataset.theme = theme.mode;
}

function applyBranding(config: PublicConfig) {
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
  const [raw, setRaw] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [chosen, setChosen] = useState<ThemeMode | null>(savedThemeMode);
  const systemReduced = useSystemReducedMotion();
  const systemDark = useSystemDark();

  const load = useCallback(() => {
    setError(null);
    api
      .get<PublicConfig>("/api/config")
      .then((c) => {
        applyBranding(c);
        setRaw(c);
      })
      .catch((e: ApiError) => setError(e));
  }, []);

  useEffect(load, [load]);

  const config = useMemo<AppConfig | null>(() => {
    if (!raw) return null;
    const fallback: ThemeMode = raw.theme.mode === "system" ? (systemDark ? "dark" : "light") : raw.theme.mode;
    const mode = raw.theme.allowUserSwitch && chosen ? chosen : fallback;
    return { ...raw, theme: { ...raw.theme, mode } };
  }, [raw, chosen, systemDark]);

  useEffect(() => {
    if (config) applyTheme(config);
  }, [config]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      if (!raw?.theme.allowUserSwitch) return;
      setChosen(mode);
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {
        // Storage blocked (private window): the choice lasts until the page is closed.
      }
    },
    [raw],
  );

  if (error) return <ConnectionScreen error={error} onRetry={load} />;
  if (!config) return <Starting />;

  const reduceMotion = config.animation.reduceMotion || (config.animation.followSystemReduceMotion && systemReduced);
  return <ConfigContext.Provider value={{ config, reduceMotion, setThemeMode }}>{children}</ConfigContext.Provider>;
}
