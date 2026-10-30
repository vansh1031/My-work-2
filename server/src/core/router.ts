// Every API route in one list, and a small dispatcher that calls them without HTTP.
// Server mode registers the list with Fastify (server/src/app.ts). Browser mode calls dispatch() directly
// from the app (web/src/local-backend), so both modes run exactly the same route code.
import type { AppContext } from "./context.js";
import { AppError, ERROR_CATALOG } from "./errors.js";
import { BinaryResponse, type ApiRequest, type Route, type UploadedFile } from "./http.js";
import { userForToken } from "./auth/guard.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { factoryRoutes } from "./routes/factories.js";
import { systemRoutes } from "./routes/system.js";
import { uploadRoutes } from "./routes/uploads.js";

export const allRoutes: Route[] = [...systemRoutes, ...authRoutes, ...factoryRoutes, ...uploadRoutes, ...adminRoutes];

interface CompiledRoute {
  route: Route;
  pattern: RegExp;
  names: string[];
}

const compiled: CompiledRoute[] = allRoutes.map((route) => {
  const names: string[] = [];
  const pattern = new RegExp(
    "^" + route.path.replace(/:([a-zA-Z]+)/g, (_m, name: string) => (names.push(name), "([^/]+)")) + "$",
  );
  return { route, pattern, names };
});

export interface DispatchInput {
  method: string;
  /** Path with optional query string, like /api/factories/3/history?from=2026-10-01 */
  url: string;
  token: string | null;
  body?: unknown;
  file?: { fileName: string; mimeType: string; data: Uint8Array } | null;
}

export interface DispatchOutput {
  status: number;
  /** JSON answer, or a file. */
  body: unknown;
}

function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}

export async function dispatch(ctx: AppContext, input: DispatchInput): Promise<DispatchOutput> {
  const [path = "", queryString = ""] = input.url.split("?");
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(queryString)) query[k] = v;

  let match: { route: Route; params: Record<string, string> } | null = null;
  for (const c of compiled) {
    if (c.route.method !== input.method) continue;
    const m = c.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    c.names.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1]!)));
    match = { route: c.route, params };
    break;
  }
  if (!match) return { status: 404, body: errorBody("REQ-002", "Not found.") };

  try {
    let file: UploadedFile | null = null;
    if (match.route.fileLimitBytes && input.file) {
      file = { ...input.file, truncated: input.file.data.length > match.route.fileLimitBytes(ctx) };
    }
    const user = await userForToken(ctx.db, input.token, ctx.config.app.sessionIdleMinutes);
    const req: ApiRequest = { params: match.params, query, body: input.body ?? {}, user, sessionToken: input.token, file };
    const result = await match.route.handler(req, ctx);
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof AppError) return { status: err.status, body: errorBody(err.code, err.message, err.details) };
    console.error("[SERVER-001]", err);
    return { status: 500, body: errorBody("SERVER-001", ERROR_CATALOG["SERVER-001"].message) };
  }
}

export { BinaryResponse };
