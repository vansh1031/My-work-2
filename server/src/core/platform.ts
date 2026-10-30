// Small helpers that work the same in Node and in the browser (both have the Web Crypto API).

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function randomHex(n: number): string {
  return toHex(randomBytes(n));
}

/** Random text safe to use in a URL or header (base64url). */
export function randomToken(n = 32): string {
  let s = "";
  for (const b of randomBytes(n)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}
