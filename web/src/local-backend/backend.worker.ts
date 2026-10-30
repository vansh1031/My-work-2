// Runs the built-in backend (backend-core.ts) in a background worker, so its work (password checks, queries) never
// slows down the screen or the 3D views. As a SharedWorker, all open tabs talk to this one copy and share one
// database. The page hands over the database engine files (see index.ts), then the worker reports whether it started.
import type { AppContext } from "../../../server/src/core/context";
import { handleRequest, startBackend } from "./backend-core";
import type { EngineFiles, FromWorker, ToWorker } from "./protocol";

type Port = { onmessage: ((e: MessageEvent<ToWorker>) => void) | null; postMessage(message: FromWorker): void };

const isShared = "SharedWorkerGlobalScope" in self;
const ports: Port[] = [];
let outcome: { ok: true; ctx: AppContext } | { ok: false; error: string } | null = null;
let starting = false;

function report(port: Port) {
  if (outcome) port.postMessage(outcome.ok ? { type: "started", ok: true } : { type: "started", ok: false, error: outcome.error });
}

function startOnce(engine: EngineFiles) {
  if (starting) return;
  starting = true;
  startBackend(engine, { sharedByAllTabs: isShared }).then(
    (ctx) => (outcome = { ok: true, ctx }),
    (err) => {
      console.error("[LOCAL-001]", err);
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
    },
  ).finally(() => ports.forEach(report));
}

function serve(port: Port) {
  ports.push(port);
  port.onmessage = async (event) => {
    const message = event.data;
    if (message.type === "engine") return startOnce(message.files);
    if (!outcome?.ok) return; // The page only sends requests after "started" with ok.
    port.postMessage({ type: "reply", id: message.id, result: await handleRequest(outcome.ctx, message.input) });
  };
  port.postMessage({ type: "status", needsEngine: !starting });
  report(port);
}

if (isShared) {
  (self as unknown as { onconnect: (e: MessageEvent) => void }).onconnect = (event) => {
    const port = event.ports[0]!;
    serve(port as unknown as Port);
    port.start();
  };
} else {
  serve(self as unknown as Port);
}
