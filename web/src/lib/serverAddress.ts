// Where the server is. The default comes from config/app.json (apiBaseUrl) at build time.
// In the web version served by the server itself, the same address as the page is used.
// If allowServerAddressChange is true, the login screen lets a user point the app at another server.
const KEY = "fa.serverAddress";

function isServedByServer(): boolean {
  return window.location.protocol.startsWith("http") && !import.meta.env.DEV && !("__TAURI_INTERNALS__" in window);
}

export function getServerAddress(): string {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved && __ALLOW_SERVER_CHANGE__) return saved;
  } catch {
    // Storage can be blocked; fall back to the default.
  }
  if (import.meta.env.DEV) return "";
  if (isServedByServer()) return window.location.origin;
  return __DEFAULT_API_BASE__.replace(/\/$/, "");
}

export function setServerAddress(address: string | null): void {
  try {
    if (address) window.localStorage.setItem(KEY, address.replace(/\/$/, ""));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Ignored: the change just will not be remembered.
  }
}

export function defaultServerAddress(): string {
  return __DEFAULT_API_BASE__;
}
