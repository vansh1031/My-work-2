// The one place the app talks to the backend. Every failure becomes an ApiError with the backend's error code
// (see docs/troubleshooting.md), or NET-001 when a server cannot be reached at all.
//
// Where requests go depends on the data mode chosen when the app was built (config/app.json "dataMode"):
//   "browser": to the backend built into the app (web/src/local-backend), which keeps data in this browser
//   "server":  over the network to a Factory Atlas server
// Screens never know the difference: they always call api.get / api.post and so on.
import type { DispatchInput } from "../../../server/src/core/router";
import type { LocalBackend } from "../local-backend";
import { getServerAddress } from "./serverAddress";

export const DATA_MODE: "browser" | "server" = __DATA_MODE__;

let localBackend: Promise<LocalBackend> | null = null;

let localKind = "not started";

/** Browser mode: how the built-in backend is running (debug panel). */
export function localBackendKind(): string {
  return localKind;
}

function startLocal(): Promise<LocalBackend> {
  localBackend ??= import("../local-backend").then((m) => m.startLocalBackend());
  localBackend.then((b) => (localKind = b.kind), () => (localKind = "failed"));
  localBackend.catch(() => (localBackend = null));
  return localBackend;
}

/** Browser mode: answers a request with the built-in backend, shaped like a server response. */
async function localRequest(method: string, path: string, body: unknown, isForm: boolean): Promise<Response> {
  let backend: LocalBackend;
  try {
    backend = await startLocal();
  } catch (err) {
    const { startupFailure } = await import("../local-backend/backend-core");
    const failure = startupFailure(err);
    return Response.json(failure.body, { status: failure.status });
  }
  const input: DispatchInput = { method, url: path, token, body: isForm ? undefined : body, file: null };
  if (isForm) {
    const file = (body as FormData).get("file");
    if (file instanceof File) input.file = { fileName: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) };
  }
  const out = await backend.call(input);
  if (out.binary) {
    const { data, contentType } = out.binary;
    return new Response(new Blob([data as BlobPart], { type: contentType }), { status: out.status, headers: { "content-type": contentType } });
  }
  return Response.json(out.body, { status: out.status });
}

const TOKEN_KEY = "fa.session";
let token: string | null = readToken();
let onSessionLost: (() => void) | null = null;

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // The session then lasts only until the window is reloaded.
  }
}

export function hasToken() {
  return token !== null;
}

/** Called by AuthProvider so that an expired session sends the user back to the login screen. */
export function setSessionLostHandler(fn: (() => void) | null) {
  onSessionLost = fn;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Full URL for a server path (server mode). For images and 3D models use useFileUrl() in lib/fileUrl.ts. */
export function apiUrl(path: string): string {
  return `${getServerAddress()}${path}`;
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  let res: Response;
  if (DATA_MODE === "browser") {
    res = await localRequest(method, path, body, isForm);
  } else {
    try {
      res = await fetch(apiUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("NET-001", `Cannot reach the server at ${getServerAddress() || window.location.origin}. Check the network connection and the server address.`, 0);
    }
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const payload = type.includes("json") ? await res.json().catch(() => null) : null;
    const err = payload?.error;
    if (err?.code === "AUTH-002") {
      setToken(null);
      onSessionLost?.();
    }
    throw new ApiError(err?.code ?? `HTTP-${res.status}`, err?.message ?? `The server answered with status ${res.status}.`, res.status, err?.details);
  }
  if (type.includes("json")) return (await res.json()) as T;
  return (await res.blob()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  blob: (path: string) => request<Blob>("GET", path),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<T>("POST", path, form, true);
  },
  /** Downloads a file (Excel template, an uploaded sheet) and hands it to the browser to save. */
  download: async (path: string, fallbackName: string) => {
    saveFile(await request<Blob>("GET", path), fallbackName);
  },
};

/** Hands a file made in the app to the browser to save. */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
