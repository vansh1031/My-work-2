import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build settings come from config/app.json:
//   dataMode   "browser": the backend is built into the app and keeps data in the browser (no server needed)
//              "server":  the app talks to a Factory Atlas server at apiBaseUrl
// Building with "--mode browser" or "--mode server" overrides dataMode for that build.
const appConfig = JSON.parse(readFileSync(path.resolve(__dirname, "../config/app.json"), "utf8"));
const devApi = process.env.DEV_API_URL ?? "http://localhost:4000";

export default defineConfig(({ mode }) => {
  const dataMode = mode === "browser" || mode === "server" ? mode : appConfig.dataMode;
  return {
  plugins: [react()],
  base: "./",
  worker: { format: "es" },
  // PGlite loads its own WebAssembly files; pre-bundling would break their paths.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  define: {
    __DATA_MODE__: JSON.stringify(dataMode),
    // Browser mode only: password of the first "admin" user, and whether sample factories are added on first start.
    __INITIAL_ADMIN_PASSWORD__: JSON.stringify(process.env.INITIAL_ADMIN_PASSWORD || "change-me-now"),
    __SEED_SAMPLE_DATA__: JSON.stringify((process.env.SEED_SAMPLE_DATA ?? "true") === "true"),
    __DEFAULT_API_BASE__: JSON.stringify(process.env.API_BASE_URL || appConfig.apiBaseUrl),
    __ALLOW_SERVER_CHANGE__: JSON.stringify(appConfig.allowServerAddressChange),
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version),
  },
  resolve: {
    alias: { "@fa/shared": path.resolve(__dirname, "../shared/src/index.ts") },
  },
  server: {
    port: 5173,
    proxy: { "/api": devApi },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "maplibre", test: /node_modules[\\/]maplibre-gl/ },
            { name: "three", test: /node_modules[\\/](three|@react-three)/ },
          ],
        },
      },
    },
  },
};
});
