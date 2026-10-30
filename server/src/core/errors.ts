// Every error the server can send has a stable code. The same codes are listed in docs/troubleshooting.md
// with their cause and fix, so a problem can be diagnosed from the code alone.

export const ERROR_CATALOG = {
  "AUTH-001": { status: 401, message: "Wrong username or password." },
  "AUTH-002": { status: 401, message: "You are not signed in, or your session has expired. Please sign in again." },
  "AUTH-003": { status: 403, message: "This account has been deactivated. Contact your administrator." },
  "AUTH-004": { status: 400, message: "The current password is not correct." },
  "AUTH-005": { status: 403, message: "You must change your password before continuing." },
  "PERM-001": { status: 403, message: "Only administrators can do this." },
  "PERM-002": { status: 403, message: "You do not have access to this factory." },
  "PERM-003": { status: 403, message: "Your administrator has not allowed you to upload sheets or edit statuses." },
  "FEATURE-001": { status: 403, message: "This feature is switched off in the configuration." },
  "REQ-001": { status: 400, message: "Some fields are missing or invalid." },
  "REQ-002": { status: 404, message: "Not found." },
  "REQ-003": { status: 409, message: "That already exists." },
  "REQ-004": { status: 429, message: "Too many attempts. Wait a minute and try again." },
  "FILE-001": { status: 400, message: "No file was attached." },
  "FILE-002": { status: 413, message: "The file is too large." },
  "FILE-003": { status: 400, message: "This file type is not allowed here." },
  "UPLOAD-001": { status: 400, message: "The Excel file has problems. Fix them and upload again." },
  "UPLOAD-002": { status: 400, message: "The file could not be read as an Excel workbook (.xlsx)." },
  "SERVER-001": { status: 500, message: "Something went wrong on the server. The error has been logged." },
  "DB-001": { status: 503, message: "The database is not reachable." },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? ERROR_CATALOG[code].message);
    this.code = code;
    this.status = ERROR_CATALOG[code].status;
    this.details = details;
  }
}
