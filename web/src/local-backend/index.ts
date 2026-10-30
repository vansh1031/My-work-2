// Browser mode: the app's side of the built-in backend. lib/api.ts calls this instead of the network, so screens work
// the same in both modes.
//
// Starting it tries, in order, until one works:
//   1. a SharedWorker: one backend for all tabs, off the page's thread (best)
//   2. a normal Worker: one per tab, only one tab can use the data at a time
//   3. the page itself: for app windows that cannot run the backend in a worker
// The database engine files are downloaded here, by the page, and handed over, because in some desktop windows a
// worker cannot download files itself.
import type { DispatchInput } from "../../../server/src/core/router";
import type { BackendResult, EngineFiles, FromWorker, ToWorker } from "./protocol";
// The PGlite package does not list these files for import, so they are referenced by their place in node_modules.
import pgliteWasmUrl from "../../../node_modules/@electric-sql/pglite/dist/pglite.wasm?url";
import initdbWasmUrl from "../../../node_modules/@electric-sql/pglite/dist/initdb.wasm?url";
import fsBundleUrl from "../../../node_modules/@electric-sql/pglite/dist/pglite.data?url";

export interface LocalBackend {
  /** Which of the three ways is in use, shown in the debug panel. */
  kind: "shared-worker" | "worker" | "page";
  call(input: DispatchInput): Promise<BackendResult>;
}

async function download(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download ${url} (status ${res.status})`);
  return res.arrayBuffer();
}

async function engineFiles(): Promise<EngineFiles> {
  const [pgliteWasm, initdbWasm, fsBundle] = await Promise.all([download(pgliteWasmUrl), download(initdbWasmUrl), download(fsBundleUrl)]);
  return { pgliteWasm, initdbWasm, fsBundle };
}

/** If a worker's script cannot even be loaded, it never says anything: give up on it after this long. */
const NO_ANSWER_MS = 15_000;

function startInWorker(shared: boolean): Promise<LocalBackend> {
  return new Promise((resolve, reject) => {
    // Each "new ...Worker(new URL(...))" must stay written in one piece: that is how the build finds and bundles it.
    let port: MessagePort | Worker;
    let target: SharedWorker | Worker;
    if (shared) {
      const w = new SharedWorker(new URL("./backend.worker.ts", import.meta.url), { type: "module", name: "factory-atlas-backend" });
      target = w;
      port = w.port;
    } else {
      target = port = new Worker(new URL("./backend.worker.ts", import.meta.url), { type: "module", name: "factory-atlas-backend" });
    }
    const fail = (why: string) => {
      clearTimeout(timer);
      if (!shared) (target as Worker).terminate();
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail("the background worker did not answer"), NO_ANSWER_MS);
    target.addEventListener("error", () => fail("the background worker could not be loaded"));

    const send = (message: ToWorker, transfer: Transferable[] = []) => port.postMessage(message, transfer);
    const pending = new Map<number, (result: BackendResult) => void>();
    let nextId = 1;
    port.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      if (message.type === "status") {
        clearTimeout(timer);
        if (message.needsEngine) {
          engineFiles().then(
            (files) => send({ type: "engine", files }, [files.pgliteWasm, files.initdbWasm, files.fsBundle]),
            (err) => fail(`could not download the database engine: ${(err as Error).message}`),
          );
        }
      } else if (message.type === "started") {
        if (!message.ok) return fail(message.error);
        resolve({
          kind: shared ? "shared-worker" : "worker",
          call(input) {
            const id = nextId++;
            return new Promise((done) => {
              pending.set(id, done);
              send({ type: "request", id, input });
            });
          },
        });
      } else {
        pending.get(message.id)?.(message.result);
        pending.delete(message.id);
      }
    };
    if (port instanceof MessagePort) port.start();
  });
}

async function startInPage(): Promise<LocalBackend> {
  const { startBackend, handleRequest } = await import("./backend-core");
  const ctx = await startBackend(await engineFiles(), { sharedByAllTabs: false });
  return { kind: "page", call: (input) => handleRequest(ctx, input) };
}

export async function startLocalBackend(): Promise<LocalBackend> {
  const attempts: [string, () => Promise<LocalBackend>][] = [];
  if (typeof SharedWorker !== "undefined") attempts.push(["shared worker", () => startInWorker(true)]);
  if (typeof Worker !== "undefined") attempts.push(["worker", () => startInWorker(false)]);
  attempts.push(["page", startInPage]);

  const problems: string[] = [];
  for (const [name, attempt] of attempts) {
    try {
      return await attempt();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // These are not about where the backend runs, so trying another way would not help.
      if (/^(CONFIG-001|LOCAL-002)/.test(message)) throw err;
      console.warn(`[LOCAL-003] built-in backend could not start as a ${name}: ${message}`);
      problems.push(`${name}: ${message}`);
    }
  }
  throw new Error(problems.join("; "));
}
