import type { AppConfig } from "./config/schema.js";
import type { Db } from "./db.js";
import type { FileStore } from "./services/files.js";

/** Everything a route needs, created once at startup (server/src/node/bootstrap.ts or web/src/local-backend). */
export interface AppContext {
  db: Db;
  config: AppConfig;
  version: string;
  /** Uploaded factory photos and 3D models. */
  files: FileStore;
  /** Reads a file from the config folder (logo, favicon). Returns null if it does not exist. */
  readConfigAsset(path: string): Promise<Uint8Array | null>;
}
