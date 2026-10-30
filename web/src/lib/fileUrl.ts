// Address for a file served by the backend (factory photo, 3D model, logo, favicon), usable in <img src> or the
// 3D model loader. In server mode that is simply the server URL. In browser mode the file comes from the built-in
// backend, so it is loaded once and turned into a temporary blob: address.
import { useEffect, useState } from "react";
import { api, apiUrl, DATA_MODE } from "./api";

const cache = new Map<string, Promise<string>>();

export function fileUrl(path: string): Promise<string> {
  if (DATA_MODE === "server") return Promise.resolve(apiUrl(path));
  let url = cache.get(path);
  if (!url) {
    url = api.blob(path).then((blob) => URL.createObjectURL(blob));
    url.catch(() => cache.delete(path));
    cache.set(path, url);
  }
  return url;
}

/** null while loading (browser mode) or when path is null. */
export function useFileUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (path && DATA_MODE === "server" ? apiUrl(path) : null));
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    fileUrl(path).then(
      (u) => !cancelled && setUrl(u),
      () => !cancelled && setUrl(null),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}
