// What the app receives from GET /api/config. The server's publicConfig() is typed against this,
// so a config field added on one side and forgotten on the other fails the typecheck.

export interface Palette {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  focus: string;
}

export interface PublicConfig {
  branding: {
    companyName: string;
    appTitle: string;
    loginHeading: string;
    loginSubheading: string;
    logo: string;
    favicon: string;
    supportContact: string;
  };
  theme: {
    mode: "dark" | "light" | "system";
    allowUserSwitch: boolean;
    fontFamily: string;
    cornerRadiusPx: number;
    palettes: { dark: Palette; light: Palette };
    statusColors: Record<"running" | "stopped" | "aborted" | "shift_ended" | "unknown", string>;
    globe: {
      ocean: string; land: string; countryBorder: string; stateBorder: string; highlightFill: string;
      highlightFillOpacity: number; highlightBorder: string; marker: string; markerRing: string;
    };
    factoryFloor: { floor: string; gridLine: string; machineBody: string; machineAccent: string };
  };
  animation: {
    reduceMotion: boolean;
    followSystemReduceMotion: boolean;
    globe: {
      idleRotationDegreesPerSecond: number; nearDistanceKm: number; overviewZoom: number; countryZoom: number;
      stateZoom: number; cityZoom: number; longFlightDurationMs: number; stageDurationMs: number; slideDurationMs: number;
    };
    factoryFloor: {
      idleOrbitDegreesPerSecond: number; focusDurationMs: number; switchDurationMs: number;
      switchSweepDegrees: number; otherMachinesOpacityWhenFocused: number;
    };
  };
  app: {
    dataMode: "browser" | "server";
    apiBaseUrl: string;
    allowServerAddressChange: boolean;
    debug: boolean;
    sessionIdleMinutes: number;
    defaultShiftsPerDay: number;
    showSearchWhenMoreThan: number;
    dataAgeWarningDays: number;
    showMachineNamesOnFloor: boolean;
    statusLabels: Record<"running" | "stopped" | "aborted" | "shift_ended" | "unknown", string>;
    map: { useOnlineTiles: boolean; tileStyleUrl: string };
    features: { globe: boolean; factoryFloor3d: boolean; excelUpload: boolean; manualStatusEdit: boolean; history: boolean };
    legal: { privacyPolicy: string; terms: string };
  };
  excel: {
    columns: Record<"date" | "shift" | "machineCode" | "status" | "abortCount" | "remarks", string[]>;
    statusValues: Record<"running" | "stopped" | "aborted" | "shift_ended", string[]>;
    maxFileSizeMb: number;
  };
}
