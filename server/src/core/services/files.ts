// Factory photos and 3D machine models. Where the bytes are kept depends on the mode:
//   server mode:  files in DATA_DIR/files       (server/src/node/fs-file-store.ts)
//   browser mode: a table in the browser database (web/src/local-backend/db-file-store.ts)
// Files get long random names, which is what keeps them private in server mode: they can be loaded by <img> and
// the 3D loader without a sign-in header (see docs/decisions.md D-011).
import { AppError } from "../errors.js";
import { randomHex } from "../platform.js";

export interface FileStore {
  save(name: string, data: Uint8Array): Promise<void>;
  read(name: string): Promise<Uint8Array | null>;
  delete(name: string): Promise<void>;
}

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
export const MODEL_TYPES: Record<string, string> = {
  "model/gltf-binary": ".glb",
  "application/octet-stream": ".glb",
};
export const FILE_NAME_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp|glb)$/;

export const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
};

function startsWith(data: Uint8Array, bytes: number[], offset = 0): boolean {
  return bytes.every((b, i) => data[offset + i] === b);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** Checks the first bytes of the file so a renamed file of another kind is rejected. */
function looksLike(ext: string, data: Uint8Array): boolean {
  if (ext === ".jpg") return startsWith(data, [0xff, 0xd8]);
  if (ext === ".png") return startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (ext === ".webp") return startsWith(data, ascii("RIFF")) && startsWith(data, ascii("WEBP"), 8);
  if (ext === ".glb") return startsWith(data, ascii("glTF"));
  return false;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export async function saveFile(store: FileStore, mimeType: string, allowed: Record<string, string>, data: Uint8Array, fileName = ""): Promise<string> {
  let ext = allowed[mimeType];
  if (allowed === MODEL_TYPES && fileName.toLowerCase().endsWith(".glb")) ext = ".glb";
  if (!ext || !looksLike(ext, data)) {
    throw new AppError("FILE-003", `This file type is not allowed here. Allowed: ${[...new Set(Object.values(allowed))].join(", ")}.`);
  }
  const name = randomHex(16) + ext;
  await store.save(name, data);
  return name;
}

export async function deleteFile(store: FileStore, name: string | null): Promise<void> {
  if (name && FILE_NAME_PATTERN.test(name)) await store.delete(name);
}

export function fileUrl(name: string | null): string | null {
  return name ? `/api/files/${name}` : null;
}
