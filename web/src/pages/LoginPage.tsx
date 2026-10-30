import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { DATA_MODE } from "../lib/api";
import { useFileUrl } from "../lib/fileUrl";
import { defaultServerAddress, getServerAddress, setServerAddress } from "../lib/serverAddress";
import { ErrorNotice, Notice } from "../components/Notice";
import { PublicShell } from "../components/AppShell";
import { useScene } from "../state/SceneProvider";

export function LoginPage() {
  const { config } = useConfig();
  const { user, login, signedOutReason } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getServerAddress() || defaultServerAddress());
  const logo = useFileUrl("/api/brand/logo");
  useScene({ kind: "globe", factories: [], selectedId: null });

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={user.mustChangePassword ? "/account/password" : from ?? "/"} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="login-wrap">
        <form className="login-card" onSubmit={submit} aria-label="Sign in">
          {logo ? <img className="logo" src={logo} alt={config.branding.companyName} /> : <div className="logo" />}
          <div className="stack" style={{ gap: "0.25rem" }}>
            <h1>{config.branding.loginHeading}</h1>
            {config.branding.loginSubheading && <p className="muted">{config.branding.loginSubheading}</p>}
          </div>
          {signedOutReason && <Notice>{signedOutReason}</Notice>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorNotice error={error} />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>
          <p className="muted small">{config.branding.supportContact}</p>
          {__ALLOW_SERVER_CHANGE__ && DATA_MODE === "server" && (
            <div className="stack" style={{ gap: "0.4rem" }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setShowServer((s) => !s)}>
                Connection settings
              </button>
              {showServer && (
                <div className="field">
                  <label htmlFor="server">Server address</label>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <input id="server" className="input" value={server} onChange={(e) => setServer(e.target.value)} />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setServerAddress(server.trim() === defaultServerAddress() ? null : server.trim());
                        window.location.reload();
                      }}
                    >
                      Save
                    </button>
                  </div>
                  <span className="hint">The app reloads and connects to this address.</span>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </PublicShell>
  );
}
