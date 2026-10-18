// Run with: npm run check-config
// Checks every file in the config folder without starting the server, and prints what is wrong.
import { readEnv } from "../env.js";
import { loadConfig, ConfigError } from "../config/load.js";

const env = readEnv();
try {
  loadConfig(env.configDir);
  console.log(`Config OK (${env.configDir})`);
} catch (err) {
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
}
