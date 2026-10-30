// Browser mode: the config folder is built into the app (the files are copied in when the app is built).
// They are checked with the same rules as on a server (server/src/core/config/validate.ts).
import { validateConfig } from "../../../server/src/core/config/validate";

const texts = import.meta.glob("../../../config/**/*.{json,md}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
// Logo and favicon are built in as data: addresses, so reading them needs no download (see engine files in index.ts).
const assets = import.meta.glob("../../../config/**/*.{svg,png,jpg,jpeg,ico}", { query: "?inline", import: "default", eager: true }) as Record<string, string>;

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
  const dataUrl = assets[key(file)];
  if (!dataUrl) return null;
  const comma = dataUrl.indexOf(",");
  const payload = dataUrl.slice(comma + 1);
  if (dataUrl.slice(0, comma).endsWith(";base64")) return Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  return new TextEncoder().encode(decodeURIComponent(payload));
}
