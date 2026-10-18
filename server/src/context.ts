import type { AppConfig } from "./config/schema.js";
import type { Db } from "./db/pool.js";
import type { Env } from "./env.js";

/** Everything a route needs, passed in once when the server starts. */
export interface AppContext {
  db: Db;
  config: AppConfig;
  env: Env;
  version: string;
}
