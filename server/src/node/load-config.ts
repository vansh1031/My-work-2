// Server mode: reads the config folder from disk and checks it (rules in core/config/validate.ts).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "../core/config/schema.js";
import { validateConfig } from "../core/config/validate.js";

export { ConfigError, publicConfig } from "../core/config/validate.js";

export function loadConfig(dir: string): AppConfig {
  return validateConfig({
    description: dir,
    readText: (file) => {
      const full = path.join(dir, file);
      return existsSync(full) ? readFileSync(full, "utf8") : null;
    },
    exists: (file) => existsSync(path.join(dir, file)),
  });
}
