import { z } from "zod";
import { AppError } from "../errors.js";
import type { Route } from "../http.js";
import { requireUser } from "../auth/guard.js";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../auth/passwords.js";
import { createSession, endAllSessionsForUser, endSession, toSessionUser } from "../auth/sessions.js";
import { audit } from "../services/audit.js";
import { parse } from "../validate.js";

const loginBody = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) });
const changeBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200),
});

// Checked when the username does not exist, so a wrong username takes as long as a wrong password
// and nobody can find out which usernames exist by timing the answer. Made on first use.
let dummyHash: Promise<string> | null = null;

export const authRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/auth/login",
    rateLimitPerMinute: 10,
    async handler(req, ctx) {
      const body = parse(loginBody, req.body);
      const { rows } = await ctx.db.query("SELECT * FROM users WHERE lower(username) = lower($1)", [body.username]);
      const row = rows[0];
      dummyHash ??= hashPassword("not-a-real-password");
      const ok = await verifyPassword(body.password, row?.password_hash ?? (await dummyHash));
      if (!row || !ok) {
        await audit(ctx.db, row?.id ?? null, "login.failed", { username: body.username });
        throw new AppError("AUTH-001");
      }
      if (!row.active) throw new AppError("AUTH-003");
      await ctx.db.query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
      const token = await createSession(ctx.db, row.id);
      await audit(ctx.db, row.id, "login");
      return { token, user: toSessionUser(row) };
    },
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    async handler(req, ctx) {
      if (req.sessionToken) await endSession(ctx.db, req.sessionToken);
      return { ok: true };
    },
  },
  {
    method: "GET",
    path: "/api/auth/me",
    async handler(req) {
      return { user: requireUser(req, { allowPasswordChange: true }) };
    },
  },
  {
    method: "POST",
    path: "/api/auth/change-password",
    async handler(req, ctx) {
      const user = requireUser(req, { allowPasswordChange: true });
      const body = parse(changeBody, req.body);
      const { rows } = await ctx.db.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
      if (!(await verifyPassword(body.currentPassword, rows[0].password_hash))) throw new AppError("AUTH-004");
      if (body.currentPassword === body.newPassword) {
        throw new AppError("REQ-001", "The new password must be different from the current one.");
      }
      await ctx.db.query("UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE id = $1", [
        user.id,
        await hashPassword(body.newPassword),
      ]);
      // Sign out every other device, then give this device a fresh session.
      await endAllSessionsForUser(ctx.db, user.id);
      const token = await createSession(ctx.db, user.id);
      await audit(ctx.db, user.id, "password.changed");
      return { token, user: { ...user, mustChangePassword: false } };
    },
  },
];
