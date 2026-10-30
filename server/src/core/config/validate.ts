// Checks every config file against the rules in schema.ts and collects every problem with its file and field.
// Where the files come from is up to the caller: the server reads the config folder from disk
// (server/src/node/load-config.ts); the browser version has them built in (web/src/local-backend/config.ts).
import type { ZodType } from "zod";
import type { PublicConfig } from "@fa/shared";
import { animationSchema, appSchema, brandingSchema, excelSchema, themeSchema, type AppConfig } from "./schema.js";

export interface ConfigSource {
  /** Where the files are, for messages (a folder path, or "built into the app"). */
  description: string;
  /** Text of a file in the config folder, by relative path like "theme.json". null if missing. */
  readText(relativePath: string): string | null;
  exists(relativePath: string): boolean;
}

/** Thrown when a config file is missing or wrong. The message names the file and the field. */
export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`CONFIG-001: The configuration has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
    this.problems = problems;
  }
}

function readJson<T>(source: ConfigSource, file: string, schema: ZodType<T>, problems: string[]): T | undefined {
  const text = source.readText(file);
  if (text === null) {
    problems.push(`${file}: file is missing (expected in ${source.description})`);
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    problems.push(`${file}: not valid JSON (${(err as Error).message})`);
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const where = issue.path.length ? issue.path.join(".") : "(whole file)";
      problems.push(`${file} -> ${where}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

export function validateConfig(source: ConfigSource): AppConfig {
  const problems: string[] = [];
  const branding = readJson(source, "branding.json", brandingSchema, problems);
  const theme = readJson(source, "theme.json", themeSchema, problems);
  const animation = readJson(source, "animation.json", animationSchema, problems);
  const excel = readJson(source, "excel.json", excelSchema, problems);
  const app = readJson(source, "app.json", appSchema, problems);

  if (branding) {
    for (const key of ["logo", "favicon"] as const) {
      if (!source.exists(branding[key])) {
        problems.push(`branding.json -> ${key}: file "${branding[key]}" does not exist in the config folder`);
      }
    }
  }

  if (excel) {
    // The same alias in two columns, or the same status word for two statuses, would make the sheet ambiguous.
    const seenColumn = new Map<string, string>();
    for (const [field, aliases] of Object.entries(excel.columns)) {
      for (const alias of aliases) {
        const key = alias.trim().toLowerCase();
        const other = seenColumn.get(key);
        if (other) problems.push(`excel.json -> columns: "${alias}" is listed for both ${other} and ${field}`);
        seenColumn.set(key, field);
      }
    }
    const seenStatus = new Map<string, string>();
    for (const [status, words] of Object.entries(excel.statusValues)) {
      for (const word of words) {
        const key = word.trim().toLowerCase();
        const other = seenStatus.get(key);
        if (other) problems.push(`excel.json -> statusValues: "${word}" is listed for both ${other} and ${status}`);
        seenStatus.set(key, status);
      }
    }
  }

  let legal = { privacyPolicy: "", terms: "" };
  if (app) {
    const read = (file: string, label: string) => {
      const text = source.readText(file);
      if (text === null) problems.push(`app.json -> ${label}: file "${file}" does not exist in the config folder`);
      return text ?? "";
    };
    legal = { privacyPolicy: read(app.legal.privacyPolicy, "legal.privacyPolicy"), terms: read(app.legal.terms, "legal.terms") };
  }

  if (problems.length || !branding || !theme || !animation || !excel || !app) {
    throw new ConfigError(problems);
  }
  return { source: source.description, branding, theme, animation, excel, app, legal };
}

/** The part of the config the app is allowed to see before anyone signs in. */
export function publicConfig(config: AppConfig): PublicConfig {
  return {
    branding: config.branding,
    theme: config.theme,
    animation: config.animation,
    app: config.app,
    excel: { columns: config.excel.columns, statusValues: config.excel.statusValues, maxFileSizeMb: config.excel.maxFileSizeMb },
  };
}
