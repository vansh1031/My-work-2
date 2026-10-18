// Data loading for each screen. React Query keeps a short cache, so moving between screens is instant
// and data refreshes in the background.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminUser, AuditEntry, FactoryDetail, FactorySummary, Machine, MachineDetail, StatusRecord, UploadRecord,
} from "@fa/shared";
import { api } from "./api";

export const keys = {
  factories: ["factories"] as const,
  factory: (id: number) => ["factory", id] as const,
  machine: (id: number) => ["machine", id] as const,
  history: (id: number, from: string, to: string, machineId?: number) => ["history", id, from, to, machineId ?? null] as const,
  uploads: (id: number) => ["uploads", id] as const,
  adminUsers: ["admin", "users"] as const,
  adminFactories: ["admin", "factories"] as const,
  audit: ["admin", "audit"] as const,
};

export function useFactories() {
  return useQuery({ queryKey: keys.factories, queryFn: () => api.get<{ factories: FactorySummary[] }>("/api/factories").then((r) => r.factories) });
}

export function useFactory(id: number) {
  return useQuery({ queryKey: keys.factory(id), queryFn: () => api.get<{ factory: FactoryDetail }>(`/api/factories/${id}`).then((r) => r.factory) });
}

export function useMachine(id: number) {
  return useQuery({ queryKey: keys.machine(id), queryFn: () => api.get<MachineDetail>(`/api/machines/${id}`) });
}

export function useHistory(factoryId: number, from: string, to: string, machineId?: number) {
  const q = new URLSearchParams({ from, to });
  if (machineId) q.set("machineId", String(machineId));
  return useQuery({
    queryKey: keys.history(factoryId, from, to, machineId),
    queryFn: () => api.get<{ from: string; to: string; records: StatusRecord[] }>(`/api/factories/${factoryId}/history?${q}`),
  });
}

export function useUploads(factoryId: number) {
  return useQuery({ queryKey: keys.uploads(factoryId), queryFn: () => api.get<{ uploads: UploadRecord[] }>(`/api/factories/${factoryId}/uploads`).then((r) => r.uploads) });
}

/** After any change, refresh everything that shows status. */
export function useInvalidateStatus() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.factories });
    void qc.invalidateQueries({ queryKey: ["factory"] });
    void qc.invalidateQueries({ queryKey: ["machine"] });
    void qc.invalidateQueries({ queryKey: ["history"] });
    void qc.invalidateQueries({ queryKey: ["uploads"] });
    void qc.invalidateQueries({ queryKey: ["admin"] });
  };
}

export function useManualStatus(machineId: number) {
  const invalidate = useInvalidateStatus();
  return useMutation({
    mutationFn: (body: { workDate: string; shift: number; status: string; abortCount: number; remarks: string }) =>
      api.put<{ machine: Machine }>(`/api/machines/${machineId}/status`, body),
    onSuccess: invalidate,
  });
}

export function useAdminUsers() {
  return useQuery({ queryKey: keys.adminUsers, queryFn: () => api.get<{ users: AdminUser[] }>("/api/admin/users").then((r) => r.users) });
}

export function useAdminFactories() {
  return useQuery({ queryKey: keys.adminFactories, queryFn: () => api.get<{ factories: FactorySummary[] }>("/api/admin/factories").then((r) => r.factories) });
}

export function useAudit() {
  return useQuery({ queryKey: keys.audit, queryFn: () => api.get<{ entries: AuditEntry[] }>("/api/admin/audit").then((r) => r.entries) });
}
