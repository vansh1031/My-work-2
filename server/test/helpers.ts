// Test helpers. The API suite runs against two engines:
//   "postgres": the real server (Fastify + node-postgres) talking to PostgreSQL, as in server mode
//   "pglite":   the route dispatcher talking to PGlite, exactly as the browser version runs
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { PGlite } from "@electric-sql/pglite";
import { buildApp } from "../src/app.js";
import type { AppContext } from "../src/core/context.js";
import { BinaryResponse } from "../src/core/http.js";
import { pgliteDb } from "../src/core/pglite-db.js";
import { dispatch } from "../src/core/router.js";
import { prepareDatabase } from "../src/core/setup.js";
import type { FileStore } from "../src/core/services/files.js";
import { readEnv } from "../src/env.js";
import { loadConfig } from "../src/node/load-config.js";
import { readMigrations } from "../src/node/migrations.js";
import { createPgDb } from "../src/node/pg-db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = path.resolve(here, "../../config");
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/factory_atlas_test";
export const FIRST_ADMIN_PASSWORD = "first-password";

export type Engine = "postgres" | "pglite";

export interface TestResponse {
  statusCode: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(): any;
  headers: Record<string, string | undefined>;
  rawPayload: Uint8Array;
}

export interface TestFile {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}

export interface TestClient {
  request(method: string, url: string, opts?: { token?: string; body?: object; file?: TestFile }): Promise<TestResponse>;
  close(): Promise<void>;
}

function memoryFileStore(): FileStore {
  const files = new Map<string, Uint8Array>();
  return {
    save: async (name, data) => void files.set(name, data),
    read: async (name) => files.get(name) ?? null,
    delete: async (name) => void files.delete(name),
  };
}

function baseContext() {
  return {
    config: loadConfig(CONFIG_DIR),
    version: "test",
    files: memoryFileStore(),
    readConfigAsset: async (file: string) => {
      const full = path.join(CONFIG_DIR, file);
      return existsSync(full) ? new Uint8Array(readFileSync(full)) : null;
    },
  };
}

/** Builds a multipart/form-data body with one file, as a browser would send it. */
export function multipartFile(file: TestFile) {
  const boundary = "----fa-test-boundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, Buffer.from(file.data), tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function setupClient(engine: Engine): Promise<TestClient> {
  const opts = { initialAdminPassword: FIRST_ADMIN_PASSWORD, seedSampleData: false };

  if (engine === "postgres") {
    const db = createPgDb(TEST_DB_URL);
    await db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await prepareDatabase(db, readMigrations(), opts);
    const env = { ...readEnv({}), databaseUrl: TEST_DB_URL, configDir: CONFIG_DIR, webDistDir: "/nonexistent" };
    const app = await buildApp({ ...baseContext(), db, env, sampleDataAdded: false });
    return {
      async request(method, url, { token, body, file } = {}) {
        const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
        let payload: string | Buffer | object | undefined = body;
        if (file) {
          const mp = multipartFile(file);
          headers["content-type"] = mp.contentType;
          payload = mp.payload;
        }
        const res = await app.inject({ method: method as "GET", url, headers, payload });
        return {
          statusCode: res.statusCode,
          json: () => res.json(),
          headers: res.headers as Record<string, string>,
          rawPayload: new Uint8Array(res.rawPayload),
        };
      },
      async close() {
        await app.close();
        await db.end();
      },
    };
  }

  const pg = await PGlite.create();
  const db = pgliteDb(pg);
  await prepareDatabase(db, readMigrations(), opts);
  const ctx: AppContext = { ...baseContext(), db };
  return {
    async request(method, url, { token, body, file } = {}) {
      const out = await dispatch(ctx, { method, url, token: token ?? null, body, file: file ?? null });
      const binary = out.body instanceof BinaryResponse ? out.body : null;
      return {
        statusCode: out.status,
        json: () => out.body,
        headers: binary
          ? { "content-type": binary.contentType, "content-disposition": binary.downloadName ? `attachment; filename="${binary.downloadName}"` : undefined }
          : { "content-type": "application/json" },
        rawPayload: binary ? binary.data : new TextEncoder().encode(JSON.stringify(out.body)),
      };
    },
    close: () => pg.close(),
  };
}

export async function login(client: TestClient, username: string, password: string) {
  const res = await client.request("POST", "/api/auth/login", { body: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${JSON.stringify(res.json())}`);
  return res.json().token as string;
}

/** Signs in as admin and completes the forced first password change. */
export async function adminToken(client: TestClient) {
  const first = await login(client, "admin", FIRST_ADMIN_PASSWORD);
  const res = await client.request("POST", "/api/auth/change-password", {
    token: first,
    body: { currentPassword: FIRST_ADMIN_PASSWORD, newPassword: "admin-password-2" },
  });
  return res.json().token as string;
}

export const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Makes an .xlsx with the given header and rows. */
export async function makeSheet(header: string[], rows: unknown[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(header);
  for (const r of rows) ws.addRow(r);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export const HEADER = ["Date", "Shift", "Machine ID", "Status", "Abort Count", "Remarks"];
