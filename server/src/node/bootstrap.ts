// Server mode startup steps, shared by the server and the scripts: read config, connect, prepare the database.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppContext } from "../core/context.js";
import { prepareDatabase } from "../core/setup.js";
import type { Env } from "../env.js";
import { fsFileStore } from "./fs-file-store.js";
import { loadConfig } from "./load-config.js";
import { readMigrations } from "./migrations.js";
import { createPgDb, type PgDb } from "./pg-db.js";

export function readVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const candidate of ["../package.json", "../../package.json"]) {
      const file = path.join(dir, candidate);
      if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).version as string;
    }
  } catch {
    // Fall through.
  }
  return "unknown";
}

export interface NodeContext extends AppContext {
  db: PgDb;
  env: Env;
  sampleDataAdded: boolean;
}

export async function bootstrap(env: Env): Promise<NodeContext> {
  const config = loadConfig(env.configDir);
  const db = createPgDb(env.databaseUrl);
  try {
    await db.query("SELECT 1");
  } catch (err) {
    await db.end();
    throw new Error(`DB-001: Cannot connect to the database at ${env.databaseUrl.replace(/:[^:@/]+@/, ":****@")}. ${(err as Error).message}`);
  }
  const { sampleDataAdded } = await prepareDatabase(db, readMigrations(), {
    initialAdminPassword: env.initialAdminPassword,
    seedSampleData: env.seedSampleData,
  });
  return {
    db,
    config,
    env,
    version: readVersion(),
    files: fsFileStore(env.dataDir),
    readConfigAsset: async (file) => {
      const full = path.join(env.configDir, file);
      return existsSync(full) ? new Uint8Array(readFileSync(full)) : null;
    },
    sampleDataAdded,
  };
}
