import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ErrorNotice, Notice } from "../components/Notice";
import { useScene } from "../state/SceneProvider";

const MIN = 8;

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useScene({ kind: "globe", factories: [], selectedId: null });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN) return setError(new Error(`The new password must be at least ${MIN} characters.`));
    if (next !== repeat) return setError(new Error("The two new passwords do not match."));
    setBusy(true);
    try {
      await changePassword(current, next);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit} aria-label="Change password">
        <h1>Change password</h1>
        {user?.mustChangePassword && <Notice>Choose your own password before you continue. This is required the first time you sign in, or after an administrator resets it.</Notice>}
        <div className="field">
          <label htmlFor="current">Current password</label>
          <input id="current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="new">New password</label>
          <input id="new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <span className="hint">At least {MIN} characters.</span>
        </div>
        <div className="field">
          <label htmlFor="repeat">Repeat new password</label>
          <input id="repeat" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </div>
        <ErrorNotice error={error} />
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy}>Save password</button>
          {user?.mustChangePassword ? (
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>Sign out</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          )}
        </div>
      </form>
    </div>
  );
}
