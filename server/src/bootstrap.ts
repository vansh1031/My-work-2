// Startup steps shared by the server and the scripts: read config, connect, migrate, make sure an admin exists.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppContext } from "./context.js";
import { loadConfig } from "./config/load.js";
import { createPool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { hashPassword } from "./auth/passwords.js";
import type { Env } from "./env.js";

export function readVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(path.join(dir, "../package.json"), "utf8")).version as string;
  } catch {
    return "unknown";
  }
}

export async function bootstrap(env: Env): Promise<AppContext> {
  const config = loadConfig(env.configDir);
  const db = createPool(env.databaseUrl);
  try {
    await db.query("SELECT 1");
  } catch (err) {
    await db.end();
    throw new Error(`DB-001: Cannot connect to the database at ${env.databaseUrl.replace(/:[^:@/]+@/, ":****@")}. ${(err as Error).message}`);
  }
  await migrate(db);
  await ensureAdmin(db, env.initialAdminPassword);
  return { db, config, env, version: readVersion() };
}

/** On a brand new database, creates user "admin" with INITIAL_ADMIN_PASSWORD. It must be changed at first sign-in. */
export async function ensureAdmin(db: AppContext["db"], initialPassword: string) {
  const { rows } = await db.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (rows.length) return;
  await db.query(
    `INSERT INTO users (username, display_name, password_hash, role, can_update_status, must_change_password)
     VALUES ('admin', 'Administrator', $1, 'admin', TRUE, TRUE)`,
    [await hashPassword(initialPassword)],
  );
}
