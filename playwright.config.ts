// End-to-end tests: start the real server (with sample data) on a separate database and click through the app.
// Run with: npm run test:e2e   (needs PostgreSQL; set E2E_DATABASE_URL if yours is not the default below)
import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4100);
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/factory_atlas_e2e";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node e2e/reset-db.mjs && node server/dist/index.js",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(port),
      DATABASE_URL: E2E_DATABASE_URL,
      SEED_SAMPLE_DATA: "true",
      INITIAL_ADMIN_PASSWORD: "e2e-first-pass",
      DATA_DIR: "test-results/e2e-data",
      LOG_LEVEL: "warn",
    },
  },
});
