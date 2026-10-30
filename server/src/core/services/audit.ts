import type { Queryable } from "../db.js";

/** Writes one line to the permanent change log (audit_log table), shown on the Admin > Change log screen. */
export async function audit(db: Queryable, userId: number | null, action: string, details: Record<string, unknown> = {}) {
  await db.query("INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)", [userId, action, JSON.stringify(details)]);
}
