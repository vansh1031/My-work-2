// Messages between the app (web/src/local-backend/index.ts) and the backend worker (backend.worker.ts).
import type { DispatchInput } from "../../../server/src/core/router";

/** The database engine files. The app downloads them and hands them over, because in some desktop windows
 *  (WebKit on Linux) a worker cannot download files itself. */
export interface EngineFiles {
  pgliteWasm: ArrayBuffer;
  initdbWasm: ArrayBuffer;
  /** Raw bytes rather than a Blob: WebKit cannot read a downloaded Blob inside a worker. */
  fsBundle: ArrayBuffer;
}

export type ToWorker = { type: "engine"; files: EngineFiles } | { type: "request"; id: number; input: DispatchInput };

export type FromWorker =
  | { type: "status"; needsEngine: boolean }
  | { type: "started"; ok: true }
  | { type: "started"; ok: false; error: string }
  | {
      type: "reply";
      id: number;
      result: {
        status: number;
        body?: unknown;
        binary?: { data: Uint8Array; contentType: string; downloadName?: string };
      };
    };

export type BackendResult = Extract<FromWorker, { type: "reply" }>["result"];
