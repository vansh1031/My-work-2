// Stores factory photos and 3D machine models in DATA_DIR/files. Files get long random names, which is what keeps
// them private: they can be loaded by <img> and the 3D loader without a sign-in header (see docs/decisions.md D-011).
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { AppError } from "../errors.js";

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

export function filesDir(dataDir: string): string {
  const dir = path.join(dataDir, "files");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Checks the first bytes of the file so a renamed file of another kind is rejected. */
function looksLike(ext: string, data: Buffer): boolean {
  if (ext === ".jpg") return data[0] === 0xff && data[1] === 0xd8;
  if (ext === ".png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === ".webp") return data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  if (ext === ".glb") return data.subarray(0, 4).toString() === "glTF";
  return false;
}

export function saveFile(dataDir: string, mimeType: string, allowed: Record<string, string>, data: Buffer, fileName = ""): string {
  let ext = allowed[mimeType];
  if (allowed === MODEL_TYPES && fileName.toLowerCase().endsWith(".glb")) ext = ".glb";
  if (!ext || !looksLike(ext, data)) {
    throw new AppError("FILE-003", `This file type is not allowed here. Allowed: ${[...new Set(Object.values(allowed))].join(", ")}.`);
  }
  const name = randomBytes(16).toString("hex") + ext;
  writeFileSync(path.join(filesDir(dataDir), name), data);
  return name;
}

export function deleteFile(dataDir: string, name: string | null): void {
  if (!name || !FILE_NAME_PATTERN.test(name)) return;
  const full = path.join(filesDir(dataDir), name);
  if (existsSync(full)) unlinkSync(full);
}

export function fileUrl(name: string | null): string | null {
  return name ? `/api/files/${name}` : null;
}
