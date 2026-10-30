// Server mode: photos and 3D models are files in DATA_DIR/files.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FileStore } from "../core/services/files.js";

export function fsFileStore(dataDir: string): FileStore {
  const dir = path.join(dataDir, "files");
  mkdirSync(dir, { recursive: true });
  return {
    async save(name, data) {
      writeFileSync(path.join(dir, name), data);
    },
    async read(name) {
      const full = path.join(dir, name);
      return existsSync(full) ? new Uint8Array(readFileSync(full)) : null;
    },
    async delete(name) {
      const full = path.join(dir, name);
      if (existsSync(full)) unlinkSync(full);
    },
  };
}
