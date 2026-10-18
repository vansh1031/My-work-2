import { useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import type { AdminUser, FactorySummary, Role } from "@fa/shared";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { useAdminFactories, useAdminUsers, useInvalidateStatus } from "../../lib/queries";
import { ErrorNotice, Notice } from "../../components/Notice";
import { Modal } from "../../components/Modal";

function FactoryPicker({ factories, value, onChange }: { factories: FactorySummary[]; value: number[]; onChange(v: number[]): void }) {
  if (factories.length === 0) return <p className="muted small">No factories exist yet.</p>;
  return (
    <div className="stack" style={{ gap: "0.3rem", maxHeight: "12rem", overflow: "auto" }}>
      {factories.map((f) => (
        <label key={f.id} className="checkbox">
          <input
            type="checkbox"
            checked={value.includes(f.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, f.id] : value.filter((v) => v !== f.id))}
          />
          {f.name} <span className="muted small">{f.city}</span>
        </label>
      ))}
    </div>
  );
}

function UserForm({ user, factories, onClose }: { user: AdminUser | null; factories: FactorySummary[]; onClose(): void }) {
  const invalidate = useInvalidateStatus();
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "user");
  const [canUpdateStatus, setCanUpdate] = useState(user?.canUpdateStatus ?? false);
  const [active, setActive] = useState(user?.active ?? true);
  const [factoryIds, setFactoryIds] = useState<number[]>(user?.factoryIds ?? []);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) await api.patch(`/api/admin/users/${user.id}`, { displayName, role, canUpdateStatus, active, factoryIds });
      else await api.post("/api/admin/users", { username, displayName, password, role, canUpdateStatus, factoryIds });
      invalidate();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? `Edit ${user.username}` : "Add user"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {!user && (
          <div className="field">
            <label htmlFor="u-name">Username</label>
            <input id="u-name" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
            <span className="hint">Letters, numbers, dot, dash and underscore. Used to sign in.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="u-display">Full name</label>
          <input id="u-display" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        {!user && (
          <div className="field">
            <label htmlFor="u-pass">First password</label>
            <input id="u-pass" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <span className="hint">Give this to the person. They must choose their own password when they first sign in.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="u-role">Role</label>
          <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="user">User: sees only the factories ticked below</option>
            <option value="admin">Administrator: full access to everything</option>
          </select>
        </div>
        {role === "user" && (
          <>
            <label className="checkbox">
              <input type="checkbox" checked={canUpdateStatus} onChange={(e) => setCanUpdate(e.target.checked)} />
              Can upload daily sheets and edit machine status
            </label>
            <div className="field">
              <span className="label">Factories this user can see</span>
              <FactoryPicker factories={factories} value={factoryIds} onChange={setFactoryIds} />
            </div>
          </>
        )}
        {user && (
          <label className="checkbox">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Account active (untick to block sign-in immediately)
          </label>
        )}
        <ErrorNotice error={error} />
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy}>{user ? "Save changes" : "Create user"}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: AdminUser; onClose(): void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  return (
    <Modal title={`Reset password for ${user.username}`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          api.post(`/api/admin/users/${user.id}/reset-password`, { newPassword: password }).then(() => setDone(true), setError);
        }}
      >
        {done ? (
          <Notice kind="ok">Password reset. {user.displayName} is signed out everywhere and must choose a new password at next sign-in.</Notice>
        ) : (
          <>
            <div className="field">
              <label htmlFor="r-pass">Temporary password</label>
              <input id="r-pass" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <ErrorNotice error={error} />
          </>
        )}
        <div className="row">
          {!done && <button className="btn btn-primary" type="submit">Reset password</button>}
          <button className="btn btn-ghost" type="button" onClick={onClose}>{done ? "Close" : "Cancel"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersTab() {
  const users = useAdminUsers();
  const factories = useAdminFactories();
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const factoryName = new Map((factories.data ?? []).map((f) => [f.id, f.name]));
  const list = (users.data ?? []).filter((u) => u.username !== "sample-data");

  return (
    <div className="stack">
      <div className="row-between">
        <p className="muted">Users sign in with a username and password you give them. Only administrators can create accounts.</p>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus aria-hidden /> Add user</button>
      </div>
      <ErrorNotice error={users.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Username</th><th>Name</th><th>Role</th><th>Can upload and edit</th><th>Factories</th><th>Status</th><th>Last sign-in</th><th /></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>{u.role === "admin" ? "Administrator" : "User"}</td>
                <td>{u.role === "admin" || u.canUpdateStatus ? "Yes" : "No"}</td>
                <td className="small">{u.role === "admin" ? "All" : u.factoryIds.map((id) => factoryName.get(id)).filter(Boolean).join(", ") || <span className="muted">None</span>}</td>
                <td>{u.active ? (u.mustChangePassword ? "Must change password" : "Active") : <span className="muted">Deactivated</span>}</td>
                <td className="small">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="btn btn-sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.username}`}><Pencil aria-hidden /></button>
                    <button className="btn btn-sm" onClick={() => setResetting(u)} aria-label={`Reset password for ${u.username}`}><KeyRound aria-hidden /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserForm user={editing === "new" ? null : editing} factories={factories.data ?? []} onClose={() => setEditing(null)} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}
