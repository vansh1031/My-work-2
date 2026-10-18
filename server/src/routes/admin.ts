// Admin screens: users, factories, machines, photos, 3D models and the change log. All routes need role "admin".
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AdminUser, AuditEntry } from "@fa/shared";
import type { AppContext } from "../context.js";
import { withTransaction } from "../db/pool.js";
import { AppError } from "../errors.js";
import { requireAdmin } from "../auth/guard.js";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../auth/passwords.js";
import { endAllSessionsForUser } from "../auth/sessions.js";
import { audit } from "../services/audit.js";
import { deleteFile, IMAGE_TYPES, MODEL_TYPES, saveFile } from "../services/files.js";
import { getMachine, listFactories } from "../services/factories.js";
import { parse } from "../validate.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const password = z.string().min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200);
const username = z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, "may contain only letters, numbers, dot, dash and underscore");

const userCreate = z.object({
  username,
  displayName: z.string().trim().min(1).max(100),
  password,
  role: z.enum(["admin", "user"]).default("user"),
  canUpdateStatus: z.boolean().default(false),
  factoryIds: z.array(z.number().int().positive()).default([]),
});
const userUpdate = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
  canUpdateStatus: z.boolean().optional(),
  active: z.boolean().optional(),
  factoryIds: z.array(z.number().int().positive()).optional(),
});

const factoryFields = {
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  shiftsPerDay: z.number().int().min(1).max(6),
};
const machineFields = {
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  machineType: z.string().trim().min(1).max(40),
  description: z.string().max(4000),
};

async function listAdminUsers(ctx: AppContext): Promise<AdminUser[]> {
  const { rows } = await ctx.db.query(
    `SELECT u.*, COALESCE(array_agg(uf.factory_id) FILTER (WHERE uf.factory_id IS NOT NULL), '{}') AS factory_ids
     FROM users u LEFT JOIN user_factories uf ON uf.user_id = u.id
     GROUP BY u.id ORDER BY u.username`,
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    canUpdateStatus: r.can_update_status,
    active: r.active,
    mustChangePassword: r.must_change_password,
    factoryIds: r.factory_ids,
    lastLoginAt: r.last_login_at?.toISOString() ?? null,
  }));
}

async function assertFactoriesExist(ctx: AppContext, ids: number[]) {
  if (ids.length === 0) return;
  const { rows } = await ctx.db.query<{ id: number }>("SELECT id FROM factories WHERE id = ANY($1) AND NOT archived", [ids]);
  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw new AppError("REQ-001", `These factories do not exist: ${missing.join(", ")}.`);
}

async function readSingleFile(req: FastifyRequest, maxBytes: number) {
  const file = await req.file({ limits: { fileSize: maxBytes, files: 1 } });
  if (!file) throw new AppError("FILE-001");
  const data = await file.toBuffer();
  if (file.file.truncated) throw new AppError("FILE-002");
  return { data, mimeType: file.mimetype, fileName: file.filename };
}

export async function adminRoutes(app: FastifyInstance, ctx: AppContext) {
  // ---- Users ----
  app.get("/api/admin/users", async (req) => {
    requireAdmin(req);
    return { users: await listAdminUsers(ctx) };
  });

  app.post("/api/admin/users", async (req) => {
    const admin = requireAdmin(req);
    const body = parse(userCreate, req.body);
    await assertFactoriesExist(ctx, body.factoryIds);
    const exists = await ctx.db.query("SELECT 1 FROM users WHERE lower(username) = lower($1)", [body.username]);
    if (exists.rowCount) throw new AppError("REQ-003", `The username "${body.username}" is already taken.`);
    const id = await withTransaction(ctx.db, async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO users (username, display_name, password_hash, role, can_update_status, must_change_password)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
        [body.username, body.displayName, await hashPassword(body.password), body.role, body.canUpdateStatus],
      );
      const newId = rows[0]!.id;
      for (const f of body.factoryIds) {
        await client.query("INSERT INTO user_factories (user_id, factory_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [newId, f]);
      }
      await audit(client, admin.id, "user.created", { userId: newId, username: body.username, role: body.role, canUpdateStatus: body.canUpdateStatus, factoryIds: body.factoryIds });
      return newId;
    });
    return { user: (await listAdminUsers(ctx)).find((u) => u.id === id) };
  });

  app.patch("/api/admin/users/:id", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const body = parse(userUpdate, req.body);
    await assertFactoriesExist(ctx, body.factoryIds ?? []);
    if (id === admin.id && (body.active === false || body.role === "user")) {
      throw new AppError("REQ-001", "You cannot deactivate your own account or remove your own admin role.");
    }
    await withTransaction(ctx.db, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE users SET
           display_name = COALESCE($2, display_name),
           role = COALESCE($3, role),
           can_update_status = COALESCE($4, can_update_status),
           active = COALESCE($5, active)
         WHERE id = $1`,
        [id, body.displayName ?? null, body.role ?? null, body.canUpdateStatus ?? null, body.active ?? null],
      );
      if (!rowCount) throw new AppError("REQ-002");
      if (body.factoryIds) {
        await client.query("DELETE FROM user_factories WHERE user_id = $1", [id]);
        for (const f of body.factoryIds) {
          await client.query("INSERT INTO user_factories (user_id, factory_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, f]);
        }
      }
      await audit(client, admin.id, "user.updated", { userId: id, ...body });
    });
    if (body.active === false) await endAllSessionsForUser(ctx.db, id);
    return { user: (await listAdminUsers(ctx)).find((u) => u.id === id) };
  });

  app.post("/api/admin/users/:id/reset-password", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const body = parse(z.object({ newPassword: password }), req.body);
    const { rowCount } = await ctx.db.query("UPDATE users SET password_hash = $2, must_change_password = TRUE WHERE id = $1", [
      id,
      await hashPassword(body.newPassword),
    ]);
    if (!rowCount) throw new AppError("REQ-002");
    await endAllSessionsForUser(ctx.db, id);
    await audit(ctx.db, admin.id, "user.password_reset", { userId: id });
    return { ok: true };
  });

  // ---- Factories ----
  app.get("/api/admin/factories", async (req) => {
    const admin = requireAdmin(req);
    return { factories: await listFactories(ctx.db, admin) };
  });

  app.post("/api/admin/factories", async (req) => {
    const admin = requireAdmin(req);
    const body = parse(z.object(factoryFields), req.body);
    const { rows } = await ctx.db.query<{ id: number }>(
      `INSERT INTO factories (name, city, state, country, latitude, longitude, shifts_per_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [body.name, body.city, body.state, body.country, body.latitude, body.longitude, body.shiftsPerDay],
    );
    await audit(ctx.db, admin.id, "factory.created", { factoryId: rows[0]!.id, ...body });
    const [factory] = await listFactories(ctx.db, admin, [rows[0]!.id]);
    return { factory };
  });

  app.patch("/api/admin/factories/:id", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const body = parse(z.object(factoryFields).partial(), req.body);
    const { rowCount } = await ctx.db.query(
      `UPDATE factories SET
         name = COALESCE($2, name), city = COALESCE($3, city), state = COALESCE($4, state),
         country = COALESCE($5, country), latitude = COALESCE($6, latitude), longitude = COALESCE($7, longitude),
         shifts_per_day = COALESCE($8, shifts_per_day), updated_at = now()
       WHERE id = $1 AND NOT archived`,
      [id, body.name ?? null, body.city ?? null, body.state ?? null, body.country ?? null, body.latitude ?? null, body.longitude ?? null, body.shiftsPerDay ?? null],
    );
    if (!rowCount) throw new AppError("REQ-002");
    await audit(ctx.db, admin.id, "factory.updated", { factoryId: id, ...body });
    const [factory] = await listFactories(ctx.db, admin, [id]);
    return { factory };
  });

  // Archived, not deleted: its uploads and history must stay for audit.
  app.delete("/api/admin/factories/:id", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const { rowCount } = await ctx.db.query("UPDATE factories SET archived = TRUE, updated_at = now() WHERE id = $1 AND NOT archived", [id]);
    if (!rowCount) throw new AppError("REQ-002");
    await audit(ctx.db, admin.id, "factory.archived", { factoryId: id });
    return { ok: true };
  });

  app.post("/api/admin/factories/:id/photo", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const { data, mimeType } = await readSingleFile(req, 8 * 1024 * 1024);
    const old = await ctx.db.query<{ photo_file: string | null }>("SELECT photo_file FROM factories WHERE id = $1 AND NOT archived", [id]);
    if (!old.rowCount) throw new AppError("REQ-002");
    const name = saveFile(ctx.env.dataDir, mimeType, IMAGE_TYPES, data);
    await ctx.db.query("UPDATE factories SET photo_file = $2, updated_at = now() WHERE id = $1", [id, name]);
    deleteFile(ctx.env.dataDir, old.rows[0]!.photo_file);
    await audit(ctx.db, admin.id, "factory.photo_changed", { factoryId: id });
    const [factory] = await listFactories(ctx.db, admin, [id]);
    return { factory };
  });

  // ---- Machines ----
  app.post("/api/admin/factories/:id/machines", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const body = parse(z.object({ ...machineFields, description: machineFields.description.default("") }), req.body);
    const clash = await ctx.db.query("SELECT 1 FROM machines WHERE factory_id = $1 AND lower(code) = lower($2)", [id, body.code]);
    if (clash.rowCount) throw new AppError("REQ-003", `Machine ID "${body.code}" already exists in this factory.`);
    const { rows } = await ctx.db.query<{ id: number }>(
      `INSERT INTO machines (factory_id, code, name, machine_type, description)
       SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM factories WHERE id = $1 AND NOT archived) RETURNING id`,
      [id, body.code, body.name, body.machineType, body.description],
    );
    if (!rows[0]) throw new AppError("REQ-002");
    await audit(ctx.db, admin.id, "machine.created", { machineId: rows[0].id, factoryId: id, ...body });
    return { machine: await getMachine(ctx.db, rows[0].id) };
  });

  app.patch("/api/admin/machines/:id", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const body = parse(z.object(machineFields).partial(), req.body);
    if (body.code) {
      const clash = await ctx.db.query(
        "SELECT 1 FROM machines WHERE factory_id = (SELECT factory_id FROM machines WHERE id = $1) AND lower(code) = lower($2) AND id <> $1",
        [id, body.code],
      );
      if (clash.rowCount) throw new AppError("REQ-003", `Machine ID "${body.code}" already exists in this factory.`);
    }
    const { rowCount } = await ctx.db.query(
      `UPDATE machines SET code = COALESCE($2, code), name = COALESCE($3, name), machine_type = COALESCE($4, machine_type),
         description = COALESCE($5, description), updated_at = now()
       WHERE id = $1 AND NOT archived`,
      [id, body.code ?? null, body.name ?? null, body.machineType ?? null, body.description ?? null],
    );
    if (!rowCount) throw new AppError("REQ-002");
    await audit(ctx.db, admin.id, "machine.updated", { machineId: id, ...body });
    return { machine: await getMachine(ctx.db, id) };
  });

  app.delete("/api/admin/machines/:id", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    // The code gets a suffix so a new machine can reuse it; the old history keeps pointing at this row.
    const { rowCount } = await ctx.db.query(
      "UPDATE machines SET archived = TRUE, code = code || '~archived-' || id, updated_at = now() WHERE id = $1 AND NOT archived",
      [id],
    );
    if (!rowCount) throw new AppError("REQ-002");
    await audit(ctx.db, admin.id, "machine.archived", { machineId: id });
    return { ok: true };
  });

  app.post("/api/admin/machines/:id/model", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const { data, mimeType, fileName } = await readSingleFile(req, 40 * 1024 * 1024);
    const old = await ctx.db.query<{ model_file: string | null }>("SELECT model_file FROM machines WHERE id = $1 AND NOT archived", [id]);
    if (!old.rowCount) throw new AppError("REQ-002");
    const name = saveFile(ctx.env.dataDir, mimeType, MODEL_TYPES, data, fileName);
    await ctx.db.query("UPDATE machines SET model_file = $2, updated_at = now() WHERE id = $1", [id, name]);
    deleteFile(ctx.env.dataDir, old.rows[0]!.model_file);
    await audit(ctx.db, admin.id, "machine.model_changed", { machineId: id });
    return { machine: await getMachine(ctx.db, id) };
  });

  app.delete("/api/admin/machines/:id/model", async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const old = await ctx.db.query<{ model_file: string | null }>("SELECT model_file FROM machines WHERE id = $1", [id]);
    if (!old.rowCount) throw new AppError("REQ-002");
    await ctx.db.query("UPDATE machines SET model_file = NULL, updated_at = now() WHERE id = $1", [id]);
    deleteFile(ctx.env.dataDir, old.rows[0]!.model_file);
    await audit(ctx.db, admin.id, "machine.model_removed", { machineId: id });
    return { machine: await getMachine(ctx.db, id) };
  });

  // ---- Change log ----
  app.get("/api/admin/audit", async (req) => {
    requireAdmin(req);
    const { before } = parse(z.object({ before: z.coerce.number().int().positive().optional() }), req.query);
    const { rows } = await ctx.db.query(
      `SELECT a.id, a.action, a.details, a.created_at, COALESCE(u.display_name, 'unknown') AS user_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE ($1::bigint IS NULL OR a.id < $1) ORDER BY a.id DESC LIMIT 100`,
      [before ?? null],
    );
    const entries: AuditEntry[] = rows.map((r) => ({
      id: Number(r.id),
      user: r.user_name,
      action: r.action,
      details: r.details,
      createdAt: r.created_at.toISOString(),
    }));
    return { entries };
  });
}
