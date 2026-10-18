import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The server address the installed app connects to by default comes from config/app.json (apiBaseUrl).
const appConfig = JSON.parse(readFileSync(path.resolve(__dirname, "../config/app.json"), "utf8"));
const devApi = process.env.DEV_API_URL ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
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
});
