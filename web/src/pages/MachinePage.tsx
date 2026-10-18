// One machine: details, status per shift, the last 14 days, and (if the admin allowed it) a manual status edit.
// The 3D floor behind stays on this machine; Previous / Next sweep the camera to the neighbouring machine.
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { MACHINE_STATUSES, type MachineStatus } from "@fa/shared";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { addDays, daysBetween, formatDate, formatDateTime, todayIso } from "../lib/format";
import { useFactory, useMachine, useManualStatus } from "../lib/queries";
import { ErrorNotice, Notice } from "../components/Notice";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { StatusGrid } from "../components/StatusGrid";
import { useScene } from "../state/SceneProvider";

function EditStatus({ machineId, shifts, onClose }: { machineId: number; shifts: number; onClose(): void }) {
  const { config } = useConfig();
  const save = useManualStatus(machineId);
  const [workDate, setWorkDate] = useState(todayIso());
  const [shift, setShift] = useState(1);
  const [status, setStatus] = useState<MachineStatus>("running");
  const [abortCount, setAbortCount] = useState(0);
  const [remarks, setRemarks] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await save.mutateAsync({ workDate, shift, status, abortCount, remarks }).then(onClose, () => undefined);
  }

  return (
    <Modal title="Update status" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ed-date">Date</label>
            <input id="ed-date" className="input" type="date" max={todayIso()} value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ed-shift">Shift</label>
            <select id="ed-shift" className="input" value={shift} onChange={(e) => setShift(Number(e.target.value))}>
              {Array.from({ length: shifts }, (_, i) => <option key={i + 1} value={i + 1}>Shift {i + 1}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ed-status">Status</label>
            <select id="ed-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as MachineStatus)}>
              {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{config.app.statusLabels[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ed-aborts">Times aborted</label>
            <input id="ed-aborts" className="input" type="number" min={0} value={abortCount} onChange={(e) => setAbortCount(Math.max(0, Number(e.target.value)))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ed-remarks">Remarks</label>
          <textarea id="ed-remarks" className="input" maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <Notice>This change is saved with your name and the time, and appears in the history. It replaces the uploaded value for that shift.</Notice>
        <ErrorNotice error={save.error} />
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={save.isPending}>Save status</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export function MachinePage() {
  const params = useParams();
  const factoryId = Number(params.factoryId);
  const machineId = Number(params.machineId);
  const navigate = useNavigate();
  const { config } = useConfig();
  const { user } = useAuth();
  const factoryQ = useFactory(factoryId);
  const machineQ = useMachine(machineId);
  const [editing, setEditing] = useState(false);

  useScene(factoryQ.data ? { kind: "floor", factoryId, machines: factoryQ.data.machines, selectedId: machineId } : { kind: "none" });

  const machines = factoryQ.data?.machines ?? [];
  const index = machines.findIndex((m) => m.id === machineId);
  const prev = index > 0 ? machines[index - 1] : machines[machines.length - 1];
  const next = index >= 0 && index < machines.length - 1 ? machines[index + 1] : machines[0];

  const detail = machineQ.data;
  const days = useMemo(() => daysBetween(addDays(todayIso(), -13), todayIso()), []);
  const latestDay = detail?.recent[0]?.workDate ?? null;
  const shiftsToday = latestDay ? detail!.recent.filter((r) => r.workDate === latestDay).sort((a, b) => a.shift - b.shift) : [];
  const canEdit = Boolean(user?.canUpdateStatus && config.app.features.manualStatusEdit);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <section className="side-panel" aria-label="Machine details">
        <div className="panel-header">
          <Link to={`/factories/${factoryId}?m=${machineId}`} className="small row" style={{ gap: "0.3rem" }}>
            <ArrowLeft aria-hidden size={14} /> {factoryQ.data?.name ?? "Factory"}
          </Link>
          {detail && (
            <>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <h1>{detail.machine.name}</h1>
                  <div className="muted small">{detail.machine.code} &middot; {detail.machine.machineType}</div>
                </div>
                <StatusBadge status={detail.machine.current?.status} />
              </div>
              <div className="row-between">
                <div className="row">
                  {machines.length > 1 && prev && (
                    <button className="btn btn-sm" onClick={() => navigate(`/factories/${factoryId}/machines/${prev.id}`)} aria-label={`Previous machine, ${prev.name}`}>
                      <ChevronLeft aria-hidden /> Previous
                    </button>
                  )}
                  {machines.length > 1 && next && (
                    <button className="btn btn-sm" onClick={() => navigate(`/factories/${factoryId}/machines/${next.id}`)} aria-label={`Next machine, ${next.name}`}>
                      Next <ChevronRight aria-hidden />
                    </button>
                  )}
                </div>
                {canEdit && (
                  <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden /> Update status
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="panel-body">
          {(machineQ.error || factoryQ.error) && <ErrorNotice error={machineQ.error ?? factoryQ.error} />}
          {machineQ.isLoading && <div className="empty"><div className="spinner" /></div>}
          {detail && (
            <>
              <div className="section">
                <div className="section-title">About this machine</div>
                <p>{detail.machine.description || <span className="muted">No description yet.</span>}</p>
                {!detail.machine.modelUrl && <p className="muted small">The 3D view shows a placeholder shape. An administrator can upload the real 3D model.</p>}
              </div>

              <div className="section">
                <div className="section-title">{latestDay ? `Shifts on ${formatDate(latestDay)}` : "Shifts"}</div>
                {shiftsToday.length === 0 ? (
                  <p className="muted">No status recorded in the last 14 days.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Shift</th><th>Status</th><th>Aborted</th><th>Remarks</th></tr>
                      </thead>
                      <tbody>
                        {shiftsToday.map((r) => (
                          <tr key={r.shift}>
                            <td>{r.shift}</td>
                            <td><StatusBadge status={r.status} /></td>
                            <td className="mono">{r.abortCount}</td>
                            <td>
                              {r.remarks}
                              <div className="muted small">{r.source === "manual" ? "Edited" : "Uploaded"} by {r.createdBy}, {formatDateTime(r.createdAt)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="section">
                <div className="section-title">Last 14 days</div>
                <StatusGrid
                  days={days}
                  records={detail.recent}
                  rows={Array.from({ length: detail.factory.shiftsPerDay }, (_, i) => ({ key: String(i + 1), label: `Shift ${i + 1}`, machineId, shift: i + 1 }))}
                />
                <div className="row small muted">
                  Total times aborted:{" "}
                  <span className="mono">{detail.recent.reduce((n, r) => n + r.abortCount, 0)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      {editing && detail && <EditStatus machineId={machineId} shifts={detail.factory.shiftsPerDay} onClose={() => setEditing(false)} />}
    </div>
  );
}
