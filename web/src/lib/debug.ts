// What the 3D views last reported, shown in the debug panel (config/app.json "debug": true).
type Listener = () => void;

const info: Record<string, unknown> = {};
const listeners = new Set<Listener>();

export function setDebugInfo(key: string, value: unknown) {
  info[key] = value;
  listeners.forEach((l) => l());
}

export function getDebugInfo(): Record<string, unknown> {
  return info;
}

export function onDebugInfo(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
