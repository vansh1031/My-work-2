// What a route receives and returns. The same routes are served by Fastify (server mode, server/src/app.ts)
// and called directly from the app (browser mode, core/router.ts). Neither side needs to know which one runs.
import type { SessionUser } from "@fa/shared";
import type { AppContext } from "./context.js";

export interface UploadedFile {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  /** True when the file was larger than the route allows. */
  truncated: boolean;
}

export interface ApiRequest {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  user: SessionUser | null;
  sessionToken: string | null;
  /** The uploaded file, for routes that accept one (see Route.fileLimitBytes). */
  file: UploadedFile | null;
}

/** A file to send back instead of JSON (Excel template, uploaded sheet, photo, 3D model, logo). */
export class BinaryResponse {
  constructor(
    readonly data: Uint8Array,
    readonly contentType: string,
    readonly downloadName?: string,
    readonly cacheControl?: string,
  ) {}
}

export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path with :parameters, for example /api/factories/:id */
  path: string;
  /** Set for routes that accept one uploaded file: the largest size allowed, in bytes. */
  fileLimitBytes?: (ctx: AppContext) => number;
  /** Server mode only: limit requests per minute from one address. */
  rateLimitPerMinute?: number;
  handler(req: ApiRequest, ctx: AppContext): Promise<unknown>;
}
