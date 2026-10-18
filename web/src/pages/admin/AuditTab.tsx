import { formatDateTime } from "../../lib/format";
import { useAudit } from "../../lib/queries";
import { ErrorNotice } from "../../components/Notice";

const LABELS: Record<string, string> = {
  login: "Signed in",
  "login.failed": "Failed sign-in",
  "password.changed": "Changed own password",
  "user.created": "Created user",
  "user.updated": "Changed user",
  "user.password_reset": "Reset a password",
  "factory.created": "Added factory",
  "factory.updated": "Changed factory",
  "factory.archived": "Archived factory",
  "factory.photo_changed": "Changed factory photo",
  "machine.created": "Added machine",
  "machine.updated": "Changed machine",
  "machine.archived": "Archived machine",
  "machine.model_changed": "Uploaded 3D model",
  "machine.model_removed": "Removed 3D model",
  "status.manual": "Edited machine status",
  "upload.confirmed": "Uploaded daily sheet",
};

export function AuditTab() {
  const audit = useAudit();
  return (
    <div className="stack">
      <p className="muted">Every sign-in, setting change, upload and manual status edit, newest first. Entries cannot be edited or deleted. The latest 100 are shown.</p>
      <ErrorNotice error={audit.error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {(audit.data ?? []).map((e) => (
              <tr key={e.id}>
                <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.createdAt)}</td>
                <td>{e.user}</td>
                <td>{LABELS[e.action] ?? e.action}</td>
                <td className="small muted" style={{ wordBreak: "break-word" }}>
                  {Object.entries(e.details).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
