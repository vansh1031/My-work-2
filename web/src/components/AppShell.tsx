import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useConfig } from "../config/ConfigProvider";
import { useFileUrl } from "../lib/fileUrl";

export function Brand() {
  const { config } = useConfig();
  const logo = useFileUrl("/api/brand/logo");
  return (
    <Link to="/" className="brand">
      {logo ? <img src={logo} alt="" /> : <span style={{ width: "1.8rem" }} />}
      <span>{config.branding.appTitle}</span>
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Version {__APP_VERSION__}</span>
      <Link to="/status">System status</Link>
      <Link to="/privacy">Privacy policy</Link>
      <Link to="/terms">Terms and conditions</Link>
    </footer>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <UserRound aria-hidden /> {user.displayName}
      </button>
      {open && (
        <div
          role="menu"
          className="stack"
          style={{ position: "absolute", right: 0, top: "110%", zIndex: 40, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.4rem", minWidth: "12rem", gap: "0.2rem" }}
          onMouseLeave={() => setOpen(false)}
        >
          <Link role="menuitem" className="btn btn-ghost" style={{ justifyContent: "flex-start" }} to="/account/password" onClick={() => setOpen(false)}>
            <KeyRound aria-hidden /> Change password
          </Link>
          <button role="menuitem" className="btn btn-ghost" style={{ justifyContent: "flex-start" }} onClick={() => void logout()}>
            <LogOut aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <Brand />
        <nav className="topnav" aria-label="Main">
          <NavLink to="/" end>Factories</NavLink>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-right">
          <UserMenu />
        </div>
      </header>
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}

/** For screens shown before signing in (login, legal pages, status). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Brand />
      </header>
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}
