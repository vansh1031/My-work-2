// Sign-in sessions. The app receives a random token and sends it back on every request
// ("Authorization: Bearer <token>"). A session ends after `sessionIdleMinutes` (config/app.json) without use.
import { createHash, randomBytes } from "node:crypto";
import type { SessionUser } from "@fa/shared";
import type { Db } from "../db/pool.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)", [hashToken(token), userId]);
  return token;
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function endAllSessionsForUser(db: Db, userId: number): Promise<void> {
  await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "user";
  can_update_status: boolean;
  must_change_password: boolean;
  active: boolean;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    canUpdateStatus: row.role === "admin" || row.can_update_status,
    mustChangePassword: row.must_change_password,
  };
}

/** Returns the signed-in user for a token, or null if the token is unknown, idle too long, or the user is inactive. */
export async function resolveSession(db: Db, token: string, idleMinutes: number): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const { rows } = await db.query<UserRow & { session_id: number }>(
    `UPDATE sessions s SET last_seen_at = now()
     FROM users u
     WHERE s.token_hash = $1 AND u.id = s.user_id AND u.active
       AND s.last_seen_at > now() - make_interval(mins => $2)
     RETURNING s.id AS session_id, u.*`,
    [tokenHash, idleMinutes],
  );
  const row = rows[0];
  if (!row) {
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }
  return toSessionUser(row);
}
