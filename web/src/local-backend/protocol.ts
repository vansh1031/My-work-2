// Messages between the app (web/src/local-backend/index.ts) and the backend worker (backend.worker.ts).
import type { DispatchInput } from "../../../server/src/core/router";

export interface BackendRequest {
  id: number;
  input: DispatchInput;
}

export interface BackendReply {
  id: number;
  result: {
    status: number;
    body?: unknown;
    binary?: { data: Uint8Array; contentType: string; downloadName?: string };
  };
}
