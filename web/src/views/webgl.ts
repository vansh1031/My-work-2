/** True when this browser can draw 3D (WebGL). Without it the globe and the factory floor show a plain message. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
