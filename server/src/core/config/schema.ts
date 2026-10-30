// The shape of every file in /config. If a file does not match, the server refuses to start and prints
// exactly which file and which field is wrong. docs/config.md explains every field in plain words.
import { z } from "zod";
import { MACHINE_STATUSES } from "@fa/shared";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a colour like #1a2b3c");
const opacity = z.number().min(0).max(1);
const positiveMs = z.number().int().min(0).max(20000);

export const brandingSchema = z.object({
  companyName: z.string().min(1),
  appTitle: z.string().min(1),
  loginHeading: z.string().min(1),
  loginSubheading: z.string(),
  logo: z.string().min(1),
  favicon: z.string().min(1),
  supportContact: z.string(),
});

const paletteSchema = z.object({
  background: hexColor,
  surface: hexColor,
  surfaceRaised: hexColor,
  border: hexColor,
  text: hexColor,
  textMuted: hexColor,
  accent: hexColor,
  accentText: hexColor,
  danger: hexColor,
  focus: hexColor,
});

export const themeSchema = z.object({
  mode: z.enum(["dark", "light"]),
  fontFamily: z.string().min(1),
  cornerRadiusPx: z.number().min(0).max(16),
  palettes: z.object({ dark: paletteSchema, light: paletteSchema }),
  statusColors: z.object({
    running: hexColor,
    stopped: hexColor,
    aborted: hexColor,
    shift_ended: hexColor,
    unknown: hexColor,
  }),
  panelOpacity: opacity,
  background: z.object({
    dimOpacity: opacity,
    dimOpacityWhileMoving: opacity,
    blurPx: z.number().min(0).max(20),
  }),
  globe: z.object({
    ocean: hexColor,
    land: hexColor,
    countryBorder: hexColor,
    stateBorder: hexColor,
    highlightFill: hexColor,
    highlightFillOpacity: opacity,
    highlightBorder: hexColor,
    marker: hexColor,
    markerRing: hexColor,
  }),
  factoryFloor: z.object({
    floor: hexColor,
    gridLine: hexColor,
    machineBody: hexColor,
    machineAccent: hexColor,
  }),
});

export const animationSchema = z.object({
  reduceMotion: z.boolean(),
  followSystemReduceMotion: z.boolean(),
  globe: z.object({
    idleRotationDegreesPerSecond: z.number().min(0).max(60),
    nearDistanceKm: z.number().min(0),
    overviewZoom: z.number().min(0).max(22),
    countryZoom: z.number().min(0).max(22),
    stateZoom: z.number().min(0).max(22),
    cityZoom: z.number().min(0).max(22),
    longFlightDurationMs: positiveMs,
    stageDurationMs: positiveMs,
    slideDurationMs: positiveMs,
  }),
  factoryFloor: z.object({
    idleOrbitDegreesPerSecond: z.number().min(0).max(90),
    focusDurationMs: positiveMs,
    switchDurationMs: positiveMs,
    switchSweepDegrees: z.number().min(0).max(720),
    otherMachinesOpacityWhenFocused: opacity,
  }),
  cards: z.object({
    enterDurationMs: positiveMs,
    enterStaggerMs: positiveMs,
  }),
});

const columnAliases = z.array(z.string().min(1)).min(1);

export const excelSchema = z.object({
  sheet: z.string(),
  headerRow: z.number().int().min(1),
  columns: z.object({
    date: columnAliases,
    shift: columnAliases,
    machineCode: columnAliases,
    status: columnAliases,
    abortCount: columnAliases,
    remarks: columnAliases,
  }),
  statusValues: z.object(
    Object.fromEntries(MACHINE_STATUSES.map((s) => [s, columnAliases])) as Record<
      (typeof MACHINE_STATUSES)[number],
      typeof columnAliases
    >,
  ),
  dateFormats: z.array(z.enum(["YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"])).min(1),
  maxFileSizeMb: z.number().min(0.1).max(100),
  maxRows: z.number().int().min(1),
});

export const appSchema = z.object({
  dataMode: z.enum(["browser", "server"]),
  apiBaseUrl: z.string().min(1),
  allowServerAddressChange: z.boolean(),
  debug: z.boolean(),
  sessionIdleMinutes: z.number().int().min(1).max(24 * 60),
  defaultShiftsPerDay: z.number().int().min(1).max(6),
  showSearchWhenMoreThan: z.number().int().min(0),
  statusLabels: z.object({
    running: z.string().min(1),
    stopped: z.string().min(1),
    aborted: z.string().min(1),
    shift_ended: z.string().min(1),
    unknown: z.string().min(1),
  }),
  map: z.object({
    useOnlineTiles: z.boolean(),
    tileStyleUrl: z.string(),
  }),
  features: z.object({
    globe: z.boolean(),
    factoryFloor3d: z.boolean(),
    excelUpload: z.boolean(),
    manualStatusEdit: z.boolean(),
    history: z.boolean(),
  }),
  legal: z.object({
    privacyPolicy: z.string().min(1),
    terms: z.string().min(1),
  }),
});

export type BrandingConfig = z.infer<typeof brandingSchema>;
export type ThemeConfig = z.infer<typeof themeSchema>;
export type AnimationConfig = z.infer<typeof animationSchema>;
export type ExcelConfig = z.infer<typeof excelSchema>;
export type AppSettingsConfig = z.infer<typeof appSchema>;

export interface AppConfig {
  /** Where the config came from (folder path, or "built into the app"). */
  source: string;
  branding: BrandingConfig;
  theme: ThemeConfig;
  animation: AnimationConfig;
  excel: ExcelConfig;
  app: AppSettingsConfig;
  legal: { privacyPolicy: string; terms: string };
}
