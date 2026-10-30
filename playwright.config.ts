// End-to-end tests: click through the real app in two setups.
//   "browser" project: the browser-mode build (no server, data kept in the browser), served as static files
//   "server"  project: the server-mode build, served by the real server with PostgreSQL and sample data
// Run with: npm run test:e2e
// The server project needs PostgreSQL; set E2E_DATABASE_URL if yours is not the default below.
// Run only one with: npx playwright test --project browser
import { defineConfig } from "@playwright/test";

const SERVER_PORT = 4100;
const BROWSER_PORT = 4200;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/factory_atlas_e2e";
const FIRST_ADMIN_PASSWORD = "e2e-first-pass";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "browser", use: { baseURL: `http://localhost:${BROWSER_PORT}` } },
    { name: "server", use: { baseURL: `http://localhost:${SERVER_PORT}` } },
  ],
  webServer: [
    {
      command: "npm run build:e2e -w web && npm run preview:e2e -w web",
      url: `http://localhost:${BROWSER_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { INITIAL_ADMIN_PASSWORD: FIRST_ADMIN_PASSWORD, SEED_SAMPLE_DATA: "true" },
    },
    {
      command: "node e2e/reset-db.mjs && node server/dist/index.js",
      url: `http://localhost:${SERVER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(SERVER_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        SEED_SAMPLE_DATA: "true",
        INITIAL_ADMIN_PASSWORD: FIRST_ADMIN_PASSWORD,
        DATA_DIR: "test-results/e2e-data",
        LOG_LEVEL: "warn",
      },
    },
  ],
});
