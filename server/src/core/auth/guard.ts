// Checks run at the start of route handlers. Each throws an AppError with a code from errors.ts when access is denied.
import type { SessionUser } from "@fa/shared";
import type { Queryable } from "../db.js";
import { AppError } from "../errors.js";
import type { ApiRequest } from "../http.js";
import { resolveSession } from "./sessions.js";

/** Finds the signed-in user for a token from the "Authorization: Bearer" header. */
export async function userForToken(db: Queryable, token: string | null, idleMinutes: number): Promise<SessionUser | null> {
  return token ? resolveSession(db, token, idleMinutes) : null;
}

export function tokenFromHeader(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/** Signed in and, unless allowPasswordChange is set, past the forced first-login password change. */
export function requireUser(request: ApiRequest, opts: { allowPasswordChange?: boolean } = {}): SessionUser {
  const user = request.user;
  if (!user) throw new AppError("AUTH-002");
  if (user.mustChangePassword && !opts.allowPasswordChange) throw new AppError("AUTH-005");
  return user;
}

export function requireAdmin(request: ApiRequest): SessionUser {
  const user = requireUser(request);
  if (user.role !== "admin") throw new AppError("PERM-001");
  return user;
}

export function requireStatusPermission(user: SessionUser): void {
  if (!user.canUpdateStatus) throw new AppError("PERM-003");
}

/** Admins can open every factory. Other users only the ones assigned to them. */
export async function assertFactoryAccess(db: Queryable, user: SessionUser, factoryId: number): Promise<void> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM factories f
       WHERE f.id = $1 AND NOT f.archived
         AND ($3 OR EXISTS (SELECT 1 FROM user_factories uf WHERE uf.factory_id = f.id AND uf.user_id = $2))
     ) AS ok`,
    [factoryId, user.id, user.role === "admin"],
  );
  if (!rows[0]?.ok) throw new AppError("PERM-002");
}
