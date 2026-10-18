// Test helpers: a clean database for each test file, an app instance, and small request shortcuts.
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { buildApp } from "../src/app.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { loadConfig } from "../src/config/load.js";
import { createPool } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { readEnv } from "../src/env.js";
import type { AppContext } from "../src/context.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = path.resolve(here, "../../config");
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/factory_atlas_test";

export async function setupApp() {
  const db = createPool(TEST_DB_URL);
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(db);
  await ensureAdmin(db, "first-password");
  const env = { ...readEnv({}), databaseUrl: TEST_DB_URL, configDir: CONFIG_DIR, dataDir: mkdtempSync(path.join(tmpdir(), "fa-test-")), webDistDir: "/nonexistent" };
  const ctx: AppContext = { db, config: loadConfig(CONFIG_DIR), env, version: "test" };
  const app = await buildApp(ctx);
  return { app, ctx, db };
}

type App = Awaited<ReturnType<typeof setupApp>>["app"];

export async function login(app: App, username: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  return res.json().token as string;
}

/** Signs in as admin and completes the forced first password change. */
export async function adminToken(app: App) {
  const first = await login(app, "admin", "first-password");
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/change-password",
    headers: { authorization: `Bearer ${first}` },
    payload: { currentPassword: "first-password", newPassword: "admin-password-2" },
  });
  return res.json().token as string;
}

export function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

/** Builds a multipart/form-data body with one file, as a browser would send it. */
export function multipartFile(fileName: string, data: Buffer, contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  const boundary = "----fa-test-boundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

/** Makes an .xlsx with the given header and rows. */
export async function makeSheet(header: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(header);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const HEADER = ["Date", "Shift", "Machine ID", "Status", "Abort Count", "Remarks"];
