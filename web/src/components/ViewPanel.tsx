// Frame for the globe and the 3D floor. Loads the 3D code only when needed, and if this computer cannot draw 3D
// (no WebGL) or the view fails, shows a short message instead (BG-001); the rest of the page keeps working.
import { Suspense, useState, type ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { webglAvailable } from "../views/webgl";
import { setDebugInfo } from "../lib/debug";

export function ViewPanel({ label, hint, children, overlay }: { label: string; hint?: string; children: (fail: (e: Error) => void) => ReactNode; overlay?: ReactNode }) {
  const [hasWebgl] = useState(webglAvailable);
  const [failed, setFailed] = useState<string | null>(null);
  const fail = (err: Error) => {
    console.error("BG-001: view could not be drawn", err);
    setDebugInfo("view", `failed: ${err.message}`);
    setFailed(err.message);
  };
  const message = !hasWebgl ? "3D view not available on this computer (WebGL is missing). Everything else works." : failed ? `The ${label.toLowerCase()} could not be shown. Error code BG-001.` : null;
  return (
    <section className="panel view-panel" aria-label={label}>
      {message ? (
        <div className="view-message">{message}</div>
      ) : (
        <ErrorBoundary fallback={<div className="view-message">The {label.toLowerCase()} could not be shown. Error code BG-001.</div>} onError={fail}>
          <Suspense fallback={<div className="view-message"><div className="spinner" /></div>}>{children(fail)}</Suspense>
        </ErrorBoundary>
      )}
      {hint && !message && <div className="view-hint">{hint}</div>}
      {overlay}
    </section>
  );
}
