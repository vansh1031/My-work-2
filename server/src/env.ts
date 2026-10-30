// Settings that differ per machine or contain secrets come from environment variables, not config files.
// See .env.example and docs/config.md.
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export interface Env {
  port: number;
  host: string;
  databaseUrl: string;
  configDir: string;
  dataDir: string;
  webDistDir: string;
  corsOrigins: string[];
  initialAdminPassword: string;
  logLevel: string;
  seedSampleData: boolean;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return {
    port: Number(source.PORT ?? 4000),
    host: source.HOST ?? "0.0.0.0",
    databaseUrl: source.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/factory_atlas",
    configDir: path.resolve(source.CONFIG_DIR ?? path.join(repoRoot, "config")),
    dataDir: path.resolve(source.DATA_DIR ?? path.join(repoRoot, "data")),
    webDistDir: path.resolve(source.WEB_DIST_DIR ?? path.join(repoRoot, "web/dist-server")),
    corsOrigins: (source.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean),
    initialAdminPassword: source.INITIAL_ADMIN_PASSWORD ?? "change-me-now",
    logLevel: source.LOG_LEVEL ?? "info",
    seedSampleData: (source.SEED_SAMPLE_DATA ?? "false") === "true",
  };
}
