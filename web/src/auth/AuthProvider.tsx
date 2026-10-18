// Who is signed in. The session token lives in sessionStorage, so closing the app signs the user out.
// After config/app.json sessionIdleMinutes without any mouse, touch or key activity, the user is signed out too.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionUser } from "@fa/shared";
import { api, hasToken, setSessionLostHandler, setToken } from "../lib/api";
import { useConfig } from "../config/ConfigProvider";

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  signedOutReason: string | null;
  login(username: string, password: string): Promise<SessionUser>;
  logout(reason?: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(hasToken());
  const [signedOutReason, setSignedOutReason] = useState<string | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    setSessionLostHandler(() => {
      setUser(null);
      setSignedOutReason("Your session has ended. Please sign in again.");
    });
    if (hasToken()) {
      api
        .get<{ user: SessionUser }>("/api/auth/me")
        .then((r) => setUser(r.user))
        .catch(() => setToken(null))
        .finally(() => setLoading(false));
    }
    return () => setSessionLostHandler(null);
  }, []);

  const logout = useCallback(async (reason?: string) => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Signing out locally is enough if the server cannot be reached.
    }
    setToken(null);
    setUser(null);
    setSignedOutReason(reason ?? null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const mark = () => (lastActivity.current = Date.now());
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const limit = config.app.sessionIdleMinutes * 60 * 1000;
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > limit) {
        void logout(`You were signed out after ${config.app.sessionIdleMinutes} minutes without activity.`);
      }
    }, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(timer);
    };
  }, [user, config.app.sessionIdleMinutes, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.post<{ token: string; user: SessionUser }>("/api/auth/login", { username, password });
    setToken(r.token);
    lastActivity.current = Date.now();
    setSignedOutReason(null);
    setUser(r.user);
    return r.user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const r = await api.post<{ token: string; user: SessionUser }>("/api/auth/change-password", { currentPassword, newPassword });
    setToken(r.token);
    setUser(r.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signedOutReason, login, logout, changePassword }}>{children}</AuthContext.Provider>
  );
}
