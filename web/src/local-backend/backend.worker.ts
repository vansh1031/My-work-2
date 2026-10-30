// Browser mode backend, running in a background worker so its work (password checks, queries) never slows down
// the screen or the 3D views. It is a SharedWorker: all open tabs of the app talk to this one copy, so they share
// one database and stay in step. Where SharedWorker is not available, each tab starts a normal worker and only the
// first tab can use the database (LOCAL-002 in the others).
//
// It runs exactly the same route code as the server (server/src/core), on PGlite, PostgreSQL compiled to run in the
// browser. Data is kept in this browser's IndexedDB storage. See docs/decisions.md D-029 to D-032.
import { PGlite } from "@electric-sql/pglite";
import type { AppContext } from "../../../server/src/core/context";
import { pgliteDb } from "../../../server/src/core/pglite-db";
import { BinaryResponse } from "../../../server/src/core/http";
import { dispatch, type DispatchInput } from "../../../server/src/core/router";
import { prepareDatabase } from "../../../server/src/core/setup";
import { bundledConfig, readBundledAsset } from "./config";
import { dbFileStore } from "./file-store";
import type { BackendReply, BackendRequest } from "./protocol";

const migrationFiles = import.meta.glob("../../../server/src/core/migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Name of the database in the browser's storage. Changing it starts with an empty database. */
const DATABASE_NAME = "idb://factory-atlas";

const isShared = "SharedWorkerGlobalScope" in self;

/** Without SharedWorker, only one tab may open the database at a time. */
function holdSingleTabLock(): Promise<void> {
  if (isShared || !navigator.locks) return Promise.resolve();
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

async function start(): Promise<AppContext> {
  // Config first: a mistake in a config file is reported before anything else happens (CONFIG-001).
  const config = bundledConfig();
  await holdSingleTabLock();
  // relaxedDurability: changes are written to browser storage in the background instead of waiting after every
  // query. Without it every click would wait for a full save (seconds). See D-031.
  const pg = await PGlite.create({ dataDir: DATABASE_NAME, relaxedDurability: true });
  const db = pgliteDb(pg);
  const migrations = Object.entries(migrationFiles).map(([path, sql]) => ({ name: path.split("/").pop()!, sql }));
  await prepareDatabase(db, migrations, { initialAdminPassword: __INITIAL_ADMIN_PASSWORD__, seedSampleData: __SEED_SAMPLE_DATA__ });
  return { db, config, version: __APP_VERSION__, files: await dbFileStore(db), readConfigAsset: readBundledAsset };
}

const ready = start();
ready.catch((err) => console.error("[LOCAL-001]", err));

function failure(err: unknown): BackendReply["result"] {
  const reason = err instanceof Error ? err.message : String(err);
  const code = /^(CONFIG-001|LOCAL-002)/.exec(reason)?.[1] ?? "LOCAL-001";
  const message =
    code === "LOCAL-001"
      ? `The built-in database could not start in this browser. Private browsing, or blocked site storage, can cause this. (${reason})`
      : reason.replace(/^LOCAL-002: /, "");
  return { status: 503, body: { error: { code, message } } };
}

async function handle(input: DispatchInput): Promise<BackendReply["result"]> {
  let ctx: AppContext;
  try {
    ctx = await ready;
  } catch (err) {
    return failure(err);
  }
  const out = await dispatch(ctx, input);
  if (out.body instanceof BinaryResponse) {
    const { data, contentType, downloadName } = out.body;
    return { status: out.status, binary: { data, contentType, downloadName } };
  }
  return { status: out.status, body: out.body };
}

function serve(port: { onmessage: ((e: MessageEvent<BackendRequest>) => void) | null; postMessage(message: BackendReply): void }) {
  port.onmessage = async (event) => {
    const { id, input } = event.data;
    port.postMessage({ id, result: await handle(input) });
  };
}

if (isShared) {
  (self as unknown as { onconnect: (e: MessageEvent) => void }).onconnect = (event) => {
    const port = event.ports[0]!;
    serve(port as never);
    port.start();
  };
} else {
  serve(self as never);
}
