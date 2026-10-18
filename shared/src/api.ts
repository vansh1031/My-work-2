// Shapes of the data the server sends to the app. Both sides import these, so they cannot drift apart.
import type { MachineStatus } from "./status.js";

export type Role = "admin" | "user";

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  canUpdateStatus: boolean;
  mustChangePassword: boolean;
}

export interface StatusCounts {
  running: number;
  stopped: number;
  aborted: number;
  shift_ended: number;
  unknown: number;
}

export interface FactorySummary {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  shiftsPerDay: number;
  photoUrl: string | null;
  isSample: boolean;
  machineCount: number;
  statusCounts: StatusCounts;
}

export interface CurrentStatus {
  status: MachineStatus;
  workDate: string;
  shift: number;
  abortCount: number;
  source: "upload" | "manual";
  updatedAt: string;
}

export interface Machine {
  id: number;
  factoryId: number;
  code: string;
  name: string;
  machineType: string;
  description: string;
  modelUrl: string | null;
  current: CurrentStatus | null;
}

export interface FactoryDetail extends FactorySummary {
  machines: Machine[];
}

export interface StatusRecord {
  machineId: number;
  workDate: string;
  shift: number;
  status: MachineStatus;
  abortCount: number;
  remarks: string;
  source: "upload" | "manual";
  createdAt: string;
  createdBy: string;
}

export interface MachineDetail {
  machine: Machine;
  factory: FactorySummary;
  recent: StatusRecord[];
}

export interface PreviewChange {
  row: number;
  machineCode: string;
  machineName: string;
  shift: number;
  previousStatus: MachineStatus | null;
  newStatus: MachineStatus;
  abortCount: number;
  remarks: string;
}

export interface PreviewIssue {
  row: number | null;
  code: string;
  message: string;
}

export interface UploadPreview {
  fileName: string;
  workDate: string | null;
  rowCount: number;
  changes: PreviewChange[];
  errors: PreviewIssue[];
  warnings: PreviewIssue[];
  replacesUploadId: number | null;
  canConfirm: boolean;
}

export interface UploadRecord {
  id: number;
  factoryId: number;
  workDate: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  uploadedBy: string;
  uploadedAt: string;
  supersededBy: number | null;
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  canUpdateStatus: boolean;
  active: boolean;
  mustChangePassword: boolean;
  factoryIds: number[];
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: number;
  user: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
