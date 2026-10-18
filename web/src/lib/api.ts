// The one place the app talks to the server. Every failure becomes an ApiError with the server's error code
// (see docs/troubleshooting.md), or NET-001 when the server cannot be reached at all.
import { getServerAddress } from "./serverAddress";

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

/** Full URL for a server path. Used for images and 3D models, which the browser loads by itself. */
export function apiUrl(path: string): string {
  return `${getServerAddress()}${path}`;
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NET-001", `Cannot reach the server at ${getServerAddress() || window.location.origin}. Check the network connection and the server address.`, 0);
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
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<T>("POST", path, form, true);
  },
  /** Downloads a file (Excel template, an uploaded sheet) and hands it to the browser to save. */
  download: async (path: string, fallbackName: string) => {
    const blob = await request<Blob>("GET", path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};
