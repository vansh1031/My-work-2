// Checks run before route handlers. Each throws an AppError with a code from errors.ts when access is denied.
import type { FastifyRequest } from "fastify";
import type { SessionUser } from "@fa/shared";
import type { Db } from "../db/pool.js";
import { AppError } from "../errors.js";
import { resolveSession } from "./sessions.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | null;
  }
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function loadUser(request: FastifyRequest, db: Db, idleMinutes: number): Promise<void> {
  const token = bearerToken(request);
  request.sessionToken = token;
  request.user = token ? await resolveSession(db, token, idleMinutes) : null;
}

/** Signed in and, unless allowPasswordChange is set, past the forced first-login password change. */
export function requireUser(request: FastifyRequest, opts: { allowPasswordChange?: boolean } = {}): SessionUser {
  const user = request.user;
  if (!user) throw new AppError("AUTH-002");
  if (user.mustChangePassword && !opts.allowPasswordChange) throw new AppError("AUTH-005");
  return user;
}

export function requireAdmin(request: FastifyRequest): SessionUser {
  const user = requireUser(request);
  if (user.role !== "admin") throw new AppError("PERM-001");
  return user;
}

export function requireStatusPermission(user: SessionUser): void {
  if (!user.canUpdateStatus) throw new AppError("PERM-003");
}

/** Admins can open every factory. Other users only the ones assigned to them. */
export async function assertFactoryAccess(db: Db, user: SessionUser, factoryId: number): Promise<void> {
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
