// Uploads tab: every Excel file ever uploaded for this factory (they are never deleted), and the button to upload a new one.
import { Link, useParams } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { api } from "../lib/api";
import { formatBytes, formatDate, formatDateTime } from "../lib/format";
import { useFactory, useUploads } from "../lib/queries";
import { ErrorNotice } from "../components/Notice";
import { FactoryHeader } from "../components/FactoryHeader";

export function UploadsPage() {
  const id = Number(useParams().factoryId);
  const { user } = useAuth();
  const { config } = useConfig();
  const factoryQ = useFactory(id);
  const uploadsQ = useUploads(id);
  const canUpload = Boolean(user?.canUpdateStatus && config.app.features.excelUpload);

  return (
    <div className="page">
      {factoryQ.data && <FactoryHeader factory={factoryQ.data} />}
      <section className="page-panel" aria-label="Uploads">
      <div className="panel-body">
        <div className="row-between">
          <p className="muted">Every uploaded sheet is kept permanently. When a day is uploaded again, the newer file is used and the older one is marked as replaced.</p>
          {canUpload && (
            <Link to={`/factories/${id}/upload`} className="btn btn-primary">
              <Upload aria-hidden /> Upload a day's sheet
            </Link>
          )}
        </div>
        <ErrorNotice error={uploadsQ.error ?? factoryQ.error} />
        {uploadsQ.data && uploadsQ.data.length === 0 && <div className="empty">No sheets have been uploaded for this factory yet.</div>}
        {uploadsQ.data && uploadsQ.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Day</th><th>File</th><th>Rows</th><th>Uploaded by</th><th>Uploaded at</th><th>State</th><th /></tr>
              </thead>
              <tbody>
                {uploadsQ.data.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td>{formatDate(u.workDate)}</td>
                    <td>{u.fileName} <span className="muted small">({formatBytes(u.fileSize)})</span></td>
                    <td className="mono">{u.rowCount}</td>
                    <td>{u.uploadedBy}</td>
                    <td>{formatDateTime(u.uploadedAt)}</td>
                    <td>{u.supersededBy ? <span className="muted">Replaced by #{u.supersededBy}</span> : "Active"}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => void api.download(`/api/uploads/${u.id}/file`, u.fileName)} aria-label={`Download ${u.fileName}`}>
                        <Download aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </section>
    </div>
  );
}
