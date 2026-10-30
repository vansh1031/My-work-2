// Server mode: the migration SQL files are read from disk (core/migrations, copied to dist/migrations on build).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Migration } from "../core/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const candidates = [path.join(here, "../core/migrations"), path.join(here, "migrations")];
  return candidates.find((d) => existsSync(d)) ?? candidates[0]!;
}

export function readMigrations(dir = migrationsDir()): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
}
