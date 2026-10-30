// Browser mode: the config folder is built into the app (the files are copied in when the app is built).
// They are checked with the same rules as on a server (server/src/core/config/validate.ts).
import { validateConfig } from "../../../server/src/core/config/validate";

const texts = import.meta.glob("../../../config/**/*.{json,md}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const assets = import.meta.glob("../../../config/**/*.{svg,png,jpg,jpeg,ico}", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const PREFIX = "../../../config/";
const key = (relative: string) => PREFIX + relative.replace(/^\.?\//, "");

export function bundledConfig() {
  return validateConfig({
    description: "the config folder built into this app",
    readText: (file) => texts[key(file)] ?? null,
    exists: (file) => key(file) in texts || key(file) in assets,
  });
}

export async function readBundledAsset(file: string): Promise<Uint8Array | null> {
  const url = assets[key(file)];
  if (!url) return null;
  const res = await fetch(url);
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}
