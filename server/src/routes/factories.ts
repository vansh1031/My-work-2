// Factory, machine, history and manual status routes for signed-in users.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MACHINE_STATUSES, type MachineDetail } from "@fa/shared";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { assertFactoryAccess, requireStatusPermission, requireUser } from "../auth/guard.js";
import { audit } from "../services/audit.js";
import { buildTemplate } from "../services/excel.js";
import { getFactoryRow, getMachine, listFactories, listMachines, listStatusRecords } from "../services/factories.js";
import { parse } from "../validate.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-10-19");

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function factoryRoutes(app: FastifyInstance, ctx: AppContext) {
  const features = ctx.config.app.features;

  app.get("/api/factories", async (req) => {
    const user = requireUser(req);
    return { factories: await listFactories(ctx.db, user) };
  });

  app.get("/api/factories/:id", async (req) => {
    const user = requireUser(req);
    const { id } = parse(idParam, req.params);
    await assertFactoryAccess(ctx.db, user, id);
    const [summary] = await listFactories(ctx.db, user, [id]);
    if (!summary) throw new AppError("REQ-002");
    return { factory: { ...summary, machines: await listMachines(ctx.db, id) } };
  });

  app.get("/api/factories/:id/history", async (req) => {
    if (!features.history) throw new AppError("FEATURE-001");
    const user = requireUser(req);
    const { id } = parse(idParam, req.params);
    await assertFactoryAccess(ctx.db, user, id);
    const q = parse(
      z.object({ from: isoDate.optional(), to: isoDate.optional(), machineId: z.coerce.number().int().positive().optional() }),
      req.query,
    );
    const to = q.to ?? todayIso();
    const from = q.from ?? daysBefore(to, 13);
    if (from > to) throw new AppError("REQ-001", "The start date must be before the end date.");
    if (daysBefore(to, 366) > from) throw new AppError("REQ-001", "The date range can be at most one year.");
    return { from, to, records: await listStatusRecords(ctx.db, { factoryId: id, from, to, machineId: q.machineId }) };
  });

  app.get("/api/factories/:id/template", async (req, reply) => {
    const user = requireUser(req);
    const { id } = parse(idParam, req.params);
    await assertFactoryAccess(ctx.db, user, id);
    const { date } = parse(z.object({ date: isoDate.optional() }), req.query);
    const factory = (await getFactoryRow(ctx.db, id))!;
    const machines = await listMachines(ctx.db, id);
    const workDate = date ?? todayIso();
    const buffer = await buildTemplate(ctx.config.excel, factory.name, factory.shifts_per_day, machines, workDate);
    const safeName = factory.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${safeName}-${workDate}.xlsx"`)
      .send(buffer);
  });

  app.get("/api/machines/:id", async (req): Promise<MachineDetail> => {
    const user = requireUser(req);
    const { id } = parse(idParam, req.params);
    const machine = await getMachine(ctx.db, id);
    if (!machine) throw new AppError("REQ-002");
    await assertFactoryAccess(ctx.db, user, machine.factoryId);
    const [factory] = await listFactories(ctx.db, user, [machine.factoryId]);
    const to = todayIso();
    const recent = await listStatusRecords(ctx.db, { factoryId: machine.factoryId, from: daysBefore(to, 13), to, machineId: id });
    return { machine, factory: factory!, recent };
  });

  app.put("/api/machines/:id/status", async (req) => {
    if (!features.manualStatusEdit) throw new AppError("FEATURE-001");
    const user = requireUser(req);
    requireStatusPermission(user);
    const { id } = parse(idParam, req.params);
    const machine = await getMachine(ctx.db, id);
    if (!machine) throw new AppError("REQ-002");
    await assertFactoryAccess(ctx.db, user, machine.factoryId);
    const factory = (await getFactoryRow(ctx.db, machine.factoryId))!;
    const body = parse(
      z.object({
        workDate: isoDate,
        shift: z.number().int().min(1).max(factory.shifts_per_day),
        status: z.enum(MACHINE_STATUSES),
        abortCount: z.number().int().min(0).max(100000).default(0),
        remarks: z.string().max(500).default(""),
      }),
      req.body,
    );
    if (body.workDate > todayIso()) throw new AppError("REQ-001", "The date cannot be in the future.");
    await ctx.db.query(
      `INSERT INTO status_records (machine_id, work_date, shift, status, abort_count, remarks, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7)`,
      [id, body.workDate, body.shift, body.status, body.abortCount, body.remarks, user.id],
    );
    await audit(ctx.db, user.id, "status.manual", { machineId: id, machineCode: machine.code, factoryId: machine.factoryId, ...body, previous: machine.current?.status ?? null });
    return { machine: await getMachine(ctx.db, id) };
  });
}
