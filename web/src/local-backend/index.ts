// Browser mode: the app's side of the built-in backend. Starts the backend worker (backend.worker.ts) and sends it
// each request. lib/api.ts calls this instead of the network, so screens work the same in both modes.
import type { DispatchInput } from "../../../server/src/core/router";
import type { BackendReply, BackendRequest } from "./protocol";

export interface LocalBackend {
  call(input: DispatchInput): Promise<BackendReply["result"]>;
}

export async function startLocalBackend(): Promise<LocalBackend> {
  let port: MessagePort | Worker;
  if (typeof SharedWorker !== "undefined") {
    const worker = new SharedWorker(new URL("./backend.worker.ts", import.meta.url), { type: "module", name: "factory-atlas-backend" });
    port = worker.port;
    port.start();
  } else {
    port = new Worker(new URL("./backend.worker.ts", import.meta.url), { type: "module", name: "factory-atlas-backend" });
  }

  const pending = new Map<number, (result: BackendReply["result"]) => void>();
  let nextId = 1;
  port.onmessage = (event: MessageEvent<BackendReply>) => {
    pending.get(event.data.id)?.(event.data.result);
    pending.delete(event.data.id);
  };

  return {
    call(input) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        port.postMessage({ id, input } satisfies BackendRequest);
      });
    },
  };
}
