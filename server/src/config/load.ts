import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { ZodType } from "zod";
import {
  animationSchema,
  appSchema,
  brandingSchema,
  excelSchema,
  themeSchema,
  type AppConfig,
} from "./schema.js";

/** Thrown when a config file is missing or wrong. The message names the file and the field. */
export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`CONFIG-001: The configuration has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
    this.problems = problems;
  }
}

function readJson<T>(dir: string, file: string, schema: ZodType<T>, problems: string[]): T | undefined {
  const full = path.join(dir, file);
  if (!existsSync(full)) {
    problems.push(`${file}: file is missing (expected at ${full})`);
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, "utf8"));
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

function readText(dir: string, file: string, label: string, problems: string[]): string {
  const full = path.join(dir, file);
  if (!existsSync(full)) {
    problems.push(`app.json -> ${label}: file "${file}" does not exist in the config folder`);
    return "";
  }
  return readFileSync(full, "utf8");
}

export function loadConfig(dir: string): AppConfig {
  const problems: string[] = [];
  const branding = readJson(dir, "branding.json", brandingSchema, problems);
  const theme = readJson(dir, "theme.json", themeSchema, problems);
  const animation = readJson(dir, "animation.json", animationSchema, problems);
  const excel = readJson(dir, "excel.json", excelSchema, problems);
  const app = readJson(dir, "app.json", appSchema, problems);

  if (branding) {
    for (const key of ["logo", "favicon"] as const) {
      if (!existsSync(path.join(dir, branding[key]))) {
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
    legal = {
      privacyPolicy: readText(dir, app.legal.privacyPolicy, "legal.privacyPolicy", problems),
      terms: readText(dir, app.legal.terms, "legal.terms", problems),
    };
  }

  if (problems.length || !branding || !theme || !animation || !excel || !app) {
    throw new ConfigError(problems);
  }
  return { dir, branding, theme, animation, excel, app, legal };
}

/** The part of the config the app is allowed to see before anyone signs in. */
export function publicConfig(config: AppConfig) {
  return {
    branding: config.branding,
    theme: config.theme,
    animation: config.animation,
    app: config.app,
    excel: { columns: config.excel.columns, statusValues: config.excel.statusValues, maxFileSizeMb: config.excel.maxFileSizeMb },
  };
}
