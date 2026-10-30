// The built-in backend itself: creates the browser database (PGlite) and answers requests with the same route code as
// the server (server/src/core). Used by backend.worker.ts (normal case) and, as a last resort, directly in the page
// (see index.ts). Data is kept in this browser's IndexedDB storage. See docs/decisions.md D-029 to D-032.
import { PGlite } from "@electric-sql/pglite";
import { MemfsFrontendFS } from "@electric-sql/pglite/memfs-frontend";
import type { AppContext } from "../../../server/src/core/context";
import { BinaryResponse } from "../../../server/src/core/http";
import { pgliteDb } from "../../../server/src/core/pglite-db";
import { dispatch, type DispatchInput } from "../../../server/src/core/router";
import { prepareDatabase } from "../../../server/src/core/setup";
import { bundledConfig, readBundledAsset } from "./config";
import { dbFileStore } from "./file-store";
import { IdbStorage } from "./idb-storage";
import type { BackendResult, EngineFiles } from "./protocol";

const migrationFiles = import.meta.glob("../../../server/src/core/migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Name of the database in the browser's storage (IndexedDB). Changing it starts with an empty database. */
export const DATABASE_NAME = "factory-atlas-db";

/** Only one tab at a time may open the database, unless all tabs share one SharedWorker. */
function holdSingleTabLock(): Promise<void> {
  if (!navigator.locks) return Promise.resolve();
  return new Promise((resolve, reject) => {
    void navigator.locks.request("factory-atlas-database", { ifAvailable: true }, (lock) => {
      if (!lock) {
        reject(new Error("LOCAL-002: The app is already open in another tab of this browser. Close that tab, or use it there."));
        return;
      }
      resolve();
      return new Promise<void>(() => undefined); // Keep the lock while this tab is open.
    });
  });
}

export async function startBackend(engine: EngineFiles, opts: { sharedByAllTabs: boolean }): Promise<AppContext> {
  // Config first: a mistake in a config file is reported before anything else happens (CONFIG-001).
  const config = bundledConfig();
  if (!opts.sharedByAllTabs) await holdSingleTabLock();
  // Every query's changes are saved to IndexedDB before the answer comes back (only the changed 64 KB blocks, so this
  // is quick). See idb-storage.ts and D-033.
  const pg = await PGlite.create({
    fs: new MemfsFrontendFS(new IdbStorage(DATABASE_NAME)),
    relaxedDurability: false,
    pgliteWasmModule: await WebAssembly.compile(engine.pgliteWasm),
    initdbWasmModule: await WebAssembly.compile(engine.initdbWasm),
    // PGlite only calls arrayBuffer() on this. Handing it the bytes directly avoids a Blob, which WebKit on Linux
    // keeps as a temporary file that a worker cannot read back.
    fsBundle: { arrayBuffer: async () => engine.fsBundle } as unknown as Blob,
  });
  const db = pgliteDb(pg);
  const migrations = Object.entries(migrationFiles).map(([path, sql]) => ({ name: path.split("/").pop()!, sql }));
  await prepareDatabase(db, migrations, { initialAdminPassword: __INITIAL_ADMIN_PASSWORD__, seedSampleData: __SEED_SAMPLE_DATA__ });
  return { db, config, version: __APP_VERSION__, files: await dbFileStore(db), readConfigAsset: readBundledAsset };
}

export async function handleRequest(ctx: AppContext, input: DispatchInput): Promise<BackendResult> {
  const out = await dispatch(ctx, input);
  if (out.body instanceof BinaryResponse) {
    const { data, contentType, downloadName } = out.body;
    return { status: out.status, binary: { data, contentType, downloadName } };
  }
  return { status: out.status, body: out.body };
}

/** Turns a startup failure into the answer every request gets (shown on the "Cannot start" screen). */
export function startupFailure(err: unknown): BackendResult {
  const reason = err instanceof Error ? err.message : String(err);
  const code = /^(CONFIG-001|LOCAL-002)/.exec(reason)?.[1] ?? "LOCAL-001";
  const message =
    code === "LOCAL-001"
      ? `The built-in database could not start in this browser. Private browsing, or blocked site storage, can cause this. (${reason})`
      : reason.replace(/^LOCAL-002: /, "");
  return { status: 503, body: { error: { code, message } } };
}
