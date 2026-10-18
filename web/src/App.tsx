// All screens and who may open them. docs/flow.md shows how a click travels from here to the server.
import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ConfigProvider } from "./config/ConfigProvider";
import { SceneProvider } from "./state/SceneProvider";
import { BackgroundLayer } from "./background/BackgroundLayer";
import { AppShell } from "./components/AppShell";
import { DebugPanel } from "./components/DebugPanel";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { HomePage } from "./pages/HomePage";
import { FactoryPage } from "./pages/FactoryPage";
import { MachinePage } from "./pages/MachinePage";
import { HistoryPage } from "./pages/HistoryPage";
import { UploadsPage } from "./pages/UploadsPage";
import { UploadPage } from "./pages/UploadPage";
import { AdminPage } from "./pages/admin/AdminPage";
import { StatusPage } from "./pages/StatusPage";
import { LegalPage } from "./pages/LegalPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});

/** Signed in (and, for admin screens, an administrator). Otherwise back to login. */
function Protected({ children, admin = false, allowPasswordChange = false }: { children: ReactNode; admin?: boolean; allowPasswordChange?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/account/password" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AuthProvider>
          <SceneProvider>
            <HashRouter>
              <BackgroundLayer />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/privacy" element={<LegalPage page="privacy" />} />
                <Route path="/terms" element={<LegalPage page="terms" />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/account/password" element={<Protected allowPasswordChange><ChangePasswordPage /></Protected>} />
                <Route path="/" element={<Protected><HomePage /></Protected>} />
                <Route path="/factories/:factoryId" element={<Protected><FactoryPage /></Protected>} />
                <Route path="/factories/:factoryId/machines/:machineId" element={<Protected><MachinePage /></Protected>} />
                <Route path="/factories/:factoryId/history" element={<Protected><HistoryPage /></Protected>} />
                <Route path="/factories/:factoryId/uploads" element={<Protected><UploadsPage /></Protected>} />
                <Route path="/factories/:factoryId/upload" element={<Protected><UploadPage /></Protected>} />
                <Route path="/admin" element={<Protected admin><AdminPage /></Protected>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <DebugPanel />
            </HashRouter>
          </SceneProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
