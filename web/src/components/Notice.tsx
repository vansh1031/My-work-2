import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { ApiError } from "../lib/api";

type Kind = "info" | "ok" | "warn" | "error";
const ICONS = { info: Info, ok: CheckCircle2, warn: AlertTriangle, error: XCircle };

export function Notice({ kind = "info", children }: { kind?: Kind; children: ReactNode }) {
  const Icon = ICONS[kind];
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Shows any error with its code, so the code can be looked up in docs/troubleshooting.md. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : "APP-001";
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Notice kind="error">
      <div>{message}</div>
      <div className="error-code">Error code {code}</div>
    </Notice>
  );
}
