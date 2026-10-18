// Upload a day's sheet, in four steps:
//   1. Download the template (optional)  2. Choose the file  3. Preview: what will change and any problems
//   4. Confirm. Nothing is saved until step 4, and step 4 is blocked while the preview shows errors.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import type { UploadPreview } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { api } from "../lib/api";
import { formatDate, todayIso } from "../lib/format";
import { useFactory, useInvalidateStatus } from "../lib/queries";
import { ErrorNotice, Notice } from "../components/Notice";
import { StatusBadge } from "../components/StatusBadge";
import { useScene } from "../state/SceneProvider";

export function UploadPage() {
  const id = Number(useParams().factoryId);
  const { config } = useConfig();
  const factoryQ = useFactory(id);
  const invalidate = useInvalidateStatus();
  const [templateDate, setTemplateDate] = useState(todayIso());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<{ uploadId: number; workDate: string } | null>(null);
  useScene(factoryQ.data ? { kind: "floor", factoryId: id, machines: factoryQ.data.machines, selectedId: null } : { kind: "none" });

  const factory = factoryQ.data;

  async function choose(f: File | null) {
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(null);
    if (!f) return;
    if (f.size > config.excel.maxFileSizeMb * 1024 * 1024) {
      setError(new Error(`The file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is ${config.excel.maxFileSizeMb} MB.`));
      return;
    }
    setBusy(true);
    try {
      setPreview((await api.upload<{ preview: UploadPreview }>(`/api/factories/${id}/uploads/preview`, f)).preview);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.upload<{ uploadId: number }>(`/api/factories/${id}/uploads`, file);
      setDone({ uploadId: r.uploadId, workDate: preview.workDate! });
      setPreview(null);
      setFile(null);
      invalidate();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-panel" aria-label="Upload a day's sheet">
      <div className="panel-header">
        <Link to={`/factories/${id}/uploads`} className="small row" style={{ gap: "0.3rem" }}>
          <ArrowLeft aria-hidden size={14} /> Uploads
        </Link>
        <h1>Upload a day's sheet{factory ? ` for ${factory.name}` : ""}</h1>
      </div>
      <div className="panel-body">
        <div className="section">
          <div className="section-title">Step 1. Get the template (optional)</div>
          <p className="muted">The template already lists every machine and shift, with the date filled in. Fill in the Status column and, if needed, Abort Count and Remarks.</p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label htmlFor="t-date">Day</label>
              <input id="t-date" className="input" type="date" value={templateDate} onChange={(e) => setTemplateDate(e.target.value)} />
            </div>
            <button
              className="btn"
              onClick={() => void api.download(`/api/factories/${id}/template?date=${templateDate}`, `${factory?.name ?? "factory"}-${templateDate}.xlsx`).catch(setError)}
            >
              <Download aria-hidden /> Download template
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Step 2. Choose the filled-in file</div>
          <label className="btn" style={{ justifySelf: "start" }}>
            <FileSpreadsheet aria-hidden /> {file ? file.name : "Choose Excel file (.xlsx)"}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              data-testid="upload-input"
              onChange={(e) => {
                void choose(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <p className="muted small">
            Columns the app looks for: {Object.values(config.excel.columns).map((names) => names[0]).join(", ")}. One file holds one day.
          </p>
        </div>

        {busy && <div className="row"><div className="spinner" /> <span className="muted">Checking the file</span></div>}
        <ErrorNotice error={error} />
        {done && (
          <Notice kind="ok">
            Saved. Upload #{done.uploadId} for {formatDate(done.workDate)} is now active.{" "}
            <Link to={`/factories/${id}`}>See the machines</Link> or <Link to={`/factories/${id}/history`}>open the history</Link>.
          </Notice>
        )}

        {preview && (
          <div className="section" data-testid="upload-preview">
            <div className="section-title">Step 3. Check the preview. Nothing has been saved yet.</div>
            <p>
              <strong>{preview.fileName}</strong>
              {preview.workDate && <> for <strong>{formatDate(preview.workDate)}</strong></>}: {preview.rowCount} rows, {preview.changes.length} machine shifts will be updated
              {preview.errors.length > 0 && <>, <strong>{preview.errors.length} problems</strong> must be fixed first</>}.
            </p>
            {preview.errors.length > 0 && (
              <Notice kind="error">
                <strong>Problems to fix in the file, then choose it again:</strong>
                <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
                  {preview.errors.map((e, i) => (
                    <li key={i}>{e.message} <span className="error-code">{e.code}</span></li>
                  ))}
                </ul>
              </Notice>
            )}
            {preview.warnings.length > 0 && (
              <Notice kind="warn">
                <strong>Please check:</strong>
                <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w.message} <span className="error-code">{w.code}</span></li>
                  ))}
                </ul>
              </Notice>
            )}
            {preview.changes.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: "40vh" }}>
                <table>
                  <thead>
                    <tr><th>Row</th><th>Machine</th><th>Shift</th><th>Now</th><th>After saving</th><th>Aborted</th><th>Remarks</th></tr>
                  </thead>
                  <tbody>
                    {preview.changes.map((c) => (
                      <tr key={c.row}>
                        <td className="mono">{c.row}</td>
                        <td>{c.machineCode} <span className="muted">{c.machineName}</span></td>
                        <td className="mono">{c.shift}</td>
                        <td>{c.previousStatus ? <StatusBadge status={c.previousStatus} /> : <span className="muted">No data</span>}</td>
                        <td><StatusBadge status={c.newStatus} /></td>
                        <td className="mono">{c.abortCount}</td>
                        <td>{c.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="section-title">Step 4. Save</div>
            <div className="row">
              <button className="btn btn-primary" disabled={!preview.canConfirm || busy} onClick={() => void confirm()}>
                Confirm and save
              </button>
              <button className="btn btn-ghost" onClick={() => void choose(null)}>Cancel</button>
            </div>
            <p className="muted small">After saving, the file cannot be deleted. A corrected file for the same day can be uploaded later and will replace it.</p>
          </div>
        )}
      </div>
    </section>
  );
}
