import { useState, type FormEvent } from "react";
import { Archive, Box, ImageUp, Pencil, Plus } from "lucide-react";
import type { FactorySummary, Machine } from "@fa/shared";
import { useConfig } from "../../config/ConfigProvider";
import { api } from "../../lib/api";
import { useAdminFactories, useFactory, useInvalidateStatus } from "../../lib/queries";
import { ErrorNotice, Notice } from "../../components/Notice";
import { Modal } from "../../components/Modal";
import { FactoryPhoto } from "../../components/PhotoPlaceholder";
import { MACHINE_TYPES } from "../../background/floor/MachineModels";

function FactoryForm({ factory, onClose }: { factory: FactorySummary | null; onClose(): void }) {
  const { config } = useConfig();
  const invalidate = useInvalidateStatus();
  const [v, setV] = useState({
    name: factory?.name ?? "",
    city: factory?.city ?? "",
    state: factory?.state ?? "",
    country: factory?.country ?? "",
    latitude: factory ? String(factory.latitude) : "",
    longitude: factory ? String(factory.longitude) : "",
    shiftsPerDay: factory?.shiftsPerDay ?? config.app.defaultShiftsPerDay,
  });
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = { ...v, latitude: Number(v.latitude), longitude: Number(v.longitude), shiftsPerDay: Number(v.shiftsPerDay) };
    try {
      if (factory) await api.patch(`/api/admin/factories/${factory.id}`, body);
      else await api.post("/api/admin/factories", body);
      invalidate();
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Modal title={factory ? `Edit ${factory.name}` : "Add factory"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="f-name">Factory name</label>
          <input id="f-name" className="input" value={v.name} onChange={set("name")} required />
        </div>
        <div className="grid-2">
          <div className="field"><label htmlFor="f-city">City</label><input id="f-city" className="input" value={v.city} onChange={set("city")} required /></div>
          <div className="field"><label htmlFor="f-state">State or province</label><input id="f-state" className="input" value={v.state} onChange={set("state")} required /></div>
          <div className="field"><label htmlFor="f-country">Country</label><input id="f-country" className="input" value={v.country} onChange={set("country")} required /></div>
          <div className="field">
            <label htmlFor="f-shifts">Shifts per day</label>
            <input id="f-shifts" className="input" type="number" min={1} max={6} value={v.shiftsPerDay} onChange={set("shiftsPerDay")} required />
          </div>
          <div className="field"><label htmlFor="f-lat">Latitude</label><input id="f-lat" className="input" inputMode="decimal" value={v.latitude} onChange={set("latitude")} required placeholder="22.7196" /></div>
          <div className="field"><label htmlFor="f-lng">Longitude</label><input id="f-lng" className="input" inputMode="decimal" value={v.longitude} onChange={set("longitude")} required placeholder="75.8577" /></div>
        </div>
        <Notice>
          Latitude and longitude place the pin on the globe. To find them, right-click the factory in any online map and copy the two numbers.
          Write the state and country the usual way (for example "Madhya Pradesh", "India") so the globe can highlight them.
        </Notice>
        <ErrorNotice error={error} />
        <div className="row">
          <button className="btn btn-primary" type="submit">{factory ? "Save changes" : "Add factory"}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function MachineForm({ factoryId, machine, onClose }: { factoryId: number; machine: Machine | null; onClose(): void }) {
  const invalidate = useInvalidateStatus();
  const [v, setV] = useState({
    code: machine?.code ?? "",
    name: machine?.name ?? "",
    machineType: machine?.machineType ?? "generic",
    description: machine?.description ?? "",
  });
  const [error, setError] = useState<unknown>(null);
  const [modelError, setModelError] = useState<unknown>(null);
  const [modelUrl, setModelUrl] = useState(machine?.modelUrl ?? null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (machine) await api.patch(`/api/admin/machines/${machine.id}`, v);
      else await api.post(`/api/admin/factories/${factoryId}/machines`, v);
      invalidate();
      onClose();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Modal title={machine ? `Edit ${machine.code}` : "Add machine"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="m-code">Machine ID</label>
            <input id="m-code" className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} required />
            <span className="hint">Must match the Machine ID column in the Excel sheet.</span>
          </div>
          <div className="field">
            <label htmlFor="m-type">Type</label>
            <select id="m-type" className="input" value={v.machineType} onChange={(e) => setV({ ...v, machineType: e.target.value })}>
              {MACHINE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <span className="hint">Picks the placeholder 3D shape until a real model is uploaded.</span>
          </div>
        </div>
        <div className="field"><label htmlFor="m-name">Name</label><input id="m-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
        <div className="field">
          <label htmlFor="m-desc">Description</label>
          <textarea id="m-desc" className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="What the machine is and what work it does" />
        </div>
        {machine && (
          <div className="field">
            <span className="label">3D model</span>
            <div className="row">
              <span className="small">{modelUrl ? "A model is uploaded." : "Using the placeholder shape."}</span>
              <label className="btn btn-sm">
                <Box aria-hidden /> Upload .glb
                <input
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setModelError(null);
                    api.upload<{ machine: Machine }>(`/api/admin/machines/${machine.id}/model`, f).then((r) => {
                      setModelUrl(r.machine.modelUrl);
                      invalidate();
                    }, setModelError);
                  }}
                />
              </label>
              {modelUrl && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => api.del(`/api/admin/machines/${machine.id}/model`).then(() => { setModelUrl(null); invalidate(); }, setModelError)}
                >
                  Remove model
                </button>
              )}
            </div>
            <span className="hint">A single .glb file, up to 40 MB. It is scaled automatically to fit the floor.</span>
            <ErrorNotice error={modelError} />
          </div>
        )}
        <ErrorNotice error={error} />
        <div className="row">
          <button className="btn btn-primary" type="submit">{machine ? "Save changes" : "Add machine"}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function FactoryDetailAdmin({ factory }: { factory: FactorySummary }) {
  const detail = useFactory(factory.id);
  const invalidate = useInvalidateStatus();
  const [editing, setEditing] = useState(false);
  const [machineForm, setMachineForm] = useState<Machine | "new" | null>(null);
  const [error, setError] = useState<unknown>(null);

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start", gap: "1rem" }}>
        <FactoryPhoto url={factory.photoUrl} name={factory.name} className="card-thumb" />
        <div className="stack" style={{ gap: "0.3rem", flex: 1 }}>
          <h2>{factory.name}</h2>
          <div className="muted small">{factory.city}, {factory.state}, {factory.country} &middot; {factory.latitude}, {factory.longitude} &middot; {factory.shiftsPerDay} shifts</div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit details</button>
            <label className="btn btn-sm">
              <ImageUp aria-hidden /> {factory.photoUrl ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) api.upload(`/api/admin/factories/${factory.id}/photo`, f).then(invalidate, setError);
                }}
              />
            </label>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (window.confirm(`Archive ${factory.name}? It disappears for everyone. Its uploads and history are kept.`)) {
                  api.del(`/api/admin/factories/${factory.id}`).then(invalidate, setError);
                }
              }}
            >
              <Archive aria-hidden /> Archive factory
            </button>
          </div>
        </div>
      </div>
      <ErrorNotice error={error ?? detail.error} />
      <div className="row-between">
        <h3>Machines</h3>
        <button className="btn btn-sm btn-primary" onClick={() => setMachineForm("new")}><Plus aria-hidden /> Add machine</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Machine ID</th><th>Name</th><th>Type</th><th>3D model</th><th /></tr></thead>
          <tbody>
            {(detail.data?.machines ?? []).map((m) => (
              <tr key={m.id}>
                <td>{m.code}</td>
                <td>{m.name}</td>
                <td>{m.machineType}</td>
                <td>{m.modelUrl ? "Uploaded" : <span className="muted">Placeholder</span>}</td>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="btn btn-sm" onClick={() => setMachineForm(m)} aria-label={`Edit ${m.code}`}><Pencil aria-hidden /></button>
                    <button
                      className="btn btn-sm btn-danger"
                      aria-label={`Archive ${m.code}`}
                      onClick={() => {
                        if (window.confirm(`Archive ${m.code} ${m.name}? Its history is kept.`)) api.del(`/api/admin/machines/${m.id}`).then(invalidate, setError);
                      }}
                    >
                      <Archive aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {detail.data?.machines.length === 0 && <tr><td colSpan={5} className="muted">No machines yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <FactoryForm factory={factory} onClose={() => setEditing(false)} />}
      {machineForm && <MachineForm factoryId={factory.id} machine={machineForm === "new" ? null : machineForm} onClose={() => setMachineForm(null)} />}
    </div>
  );
}

export function FactoriesTab() {
  const factories = useAdminFactories();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const list = factories.data ?? [];
  const selected = list.find((f) => f.id === selectedId) ?? list[0] ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(14rem, 20rem) 1fr", gap: "1rem", alignItems: "start" }}>
      <div className="stack" style={{ gap: "0.4rem" }}>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus aria-hidden /> Add factory</button>
        <ErrorNotice error={factories.error} />
        {list.map((f) => (
          <button key={f.id} className="card" style={{ gridTemplateColumns: "1fr" }} aria-current={f.id === selected?.id} onClick={() => setSelectedId(f.id)}>
            <span className="card-title">{f.name}</span>
            <span className="card-sub">{f.city}, {f.country} &middot; {f.machineCount} machines</span>
          </button>
        ))}
      </div>
      <div>{selected ? <FactoryDetailAdmin key={selected.id} factory={selected} /> : <div className="empty">Add the first factory to get started.</div>}</div>
      {adding && <FactoryForm factory={null} onClose={() => setAdding(false)} />}
    </div>
  );
}
