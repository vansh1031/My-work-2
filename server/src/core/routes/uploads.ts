// Excel upload: preview (check only, nothing saved) and confirm (check again, then save permanently).
import { z } from "zod";
import type { MachineStatus, UploadPreview, UploadRecord } from "@fa/shared";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { BinaryResponse, type ApiRequest, type Route } from "../http.js";
import { assertFactoryAccess, requireStatusPermission, requireUser } from "../auth/guard.js";
import { audit } from "../services/audit.js";
import { readWorkbook, validateRows, type ValidRow } from "../services/excel.js";
import { getFactoryRow, listMachines } from "../services/factories.js";
import { parse } from "../validate.js";
import { todayIso, XLSX_TYPE } from "./factories.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

function uploadedSheet(req: ApiRequest) {
  const file = req.file;
  if (!file) throw new AppError("FILE-001");
  if (file.truncated) throw new AppError("FILE-002");
  if (!file.fileName.toLowerCase().endsWith(".xlsx")) {
    throw new AppError("FILE-003", "Only Excel files (.xlsx) can be uploaded. Older .xls files must be saved as .xlsx first.");
  }
  return { fileName: file.fileName.slice(0, 200), data: file.data };
}

const sheetLimit = (ctx: AppContext) => Math.round(ctx.config.excel.maxFileSizeMb * 1024 * 1024);

async function authorise(req: ApiRequest, ctx: AppContext) {
  if (!ctx.config.app.features.excelUpload) throw new AppError("FEATURE-001");
  const user = requireUser(req);
  requireStatusPermission(user);
  const { id } = parse(idParam, req.params);
  await assertFactoryAccess(ctx.db, user, id);
  return { user, factoryId: id };
}

interface Checked {
  preview: UploadPreview;
  validRows: ValidRow[];
}

async function check(ctx: AppContext, factoryId: number, fileName: string, data: Uint8Array): Promise<Checked> {
  const factory = (await getFactoryRow(ctx.db, factoryId))!;
  const machines = await listMachines(ctx.db, factoryId);
  const read = await readWorkbook(data, ctx.config.excel);

  let result = { workDate: null as string | null, changes: [] as UploadPreview["changes"], validRows: [] as ValidRow[], errors: read.errors, warnings: [] as UploadPreview["warnings"] };
  let replacesUploadId: number | null = null;

  if (read.errors.length === 0) {
    // First pass finds the day; then compare against what is already saved for that day.
    const firstPass = validateRows(read.rows, { shiftsPerDay: factory.shifts_per_day, machines, previous: new Map(), config: ctx.config.excel, today: todayIso() });
    const previous = new Map<string, MachineStatus>();
    if (firstPass.workDate) {
      const existing = await ctx.db.query<{ machine_id: number; shift: number; status: MachineStatus }>(
        `SELECT es.machine_id, es.shift, es.status FROM effective_status es JOIN machines m ON m.id = es.machine_id
         WHERE m.factory_id = $1 AND es.work_date = $2`,
        [factoryId, firstPass.workDate],
      );
      for (const r of existing.rows) previous.set(`${r.machine_id}:${r.shift}`, r.status);
      const prior = await ctx.db.query<{ id: number; uploaded_at: Date }>(
        "SELECT id, uploaded_at FROM uploads WHERE factory_id = $1 AND work_date = $2 AND superseded_by IS NULL",
        [factoryId, firstPass.workDate],
      );
      replacesUploadId = prior.rows[0]?.id ?? null;
    }
    result = validateRows(read.rows, { shiftsPerDay: factory.shifts_per_day, machines, previous, config: ctx.config.excel, today: todayIso() });
    if (replacesUploadId && result.errors.length === 0) {
      result.warnings.unshift({
        row: null,
        code: "XL-103",
        message: `A file for ${result.workDate} was already uploaded (upload #${replacesUploadId}). This file will become the active one. The earlier file stays in the upload history.`,
      });
    }
  }

  return {
    preview: {
      fileName,
      workDate: result.workDate,
      rowCount: read.rows.length,
      changes: result.changes,
      errors: result.errors,
      warnings: result.warnings,
      replacesUploadId,
      canConfirm: result.errors.length === 0 && result.validRows.length > 0,
    },
    validRows: result.validRows,
  };
}

export const uploadRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/factories/:id/uploads/preview",
    fileLimitBytes: sheetLimit,
    async handler(req, ctx) {
      const { factoryId } = await authorise(req, ctx);
      const { fileName, data } = uploadedSheet(req);
      return { preview: (await check(ctx, factoryId, fileName, data)).preview };
    },
  },
  {
    method: "POST",
    path: "/api/factories/:id/uploads",
    fileLimitBytes: sheetLimit,
    async handler(req, ctx) {
      const { user, factoryId } = await authorise(req, ctx);
      const { fileName, data } = uploadedSheet(req);
      // Checked again here: the preview could be stale, or the request could come from outside the app.
      const { preview, validRows } = await check(ctx, factoryId, fileName, data);
      if (!preview.canConfirm || !preview.workDate) throw new AppError("UPLOAD-001", undefined, preview);

      const uploadId = await ctx.db.transaction(async (client) => {
        // Lock this factory's uploads for the day so two people confirming at once cannot both become active.
        await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [factoryId, preview.workDate]);
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO uploads (factory_id, work_date, file_name, file_data, file_size, row_count, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [factoryId, preview.workDate, fileName, data, data.length, validRows.length, user.id],
        );
        const id = inserted.rows[0]!.id;
        await client.query(
          "UPDATE uploads SET superseded_by = $1 WHERE factory_id = $2 AND work_date = $3 AND superseded_by IS NULL AND id <> $1",
          [id, factoryId, preview.workDate],
        );
        for (const r of validRows) {
          await client.query(
            `INSERT INTO status_records (machine_id, work_date, shift, status, abort_count, remarks, source, upload_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, 'upload', $7, $8)`,
            [r.machineId, preview.workDate, r.shift, r.status, r.abortCount, r.remarks, id, user.id],
          );
        }
        await audit(client, user.id, "upload.confirmed", { uploadId: id, factoryId, workDate: preview.workDate, fileName, rows: validRows.length, replaces: preview.replacesUploadId });
        return id;
      });
      return { uploadId, preview };
    },
  },
  {
    method: "GET",
    path: "/api/factories/:id/uploads",
    async handler(req, ctx) {
      const user = requireUser(req);
      const { id } = parse(idParam, req.params);
      await assertFactoryAccess(ctx.db, user, id);
      const { rows } = await ctx.db.query(
        `SELECT up.id, up.factory_id, up.work_date, up.file_name, up.file_size, up.row_count, up.uploaded_at, up.superseded_by,
                u.display_name AS uploaded_by
         FROM uploads up JOIN users u ON u.id = up.uploaded_by
         WHERE up.factory_id = $1 ORDER BY up.uploaded_at DESC LIMIT 200`,
        [id],
      );
      const uploads: UploadRecord[] = rows.map((r) => ({
        id: r.id,
        factoryId: r.factory_id,
        workDate: r.work_date,
        fileName: r.file_name,
        fileSize: r.file_size,
        rowCount: r.row_count,
        uploadedBy: r.uploaded_by,
        uploadedAt: r.uploaded_at.toISOString(),
        supersededBy: r.superseded_by,
      }));
      return { uploads };
    },
  },
  {
    method: "GET",
    path: "/api/uploads/:id/file",
    async handler(req, ctx) {
      const user = requireUser(req);
      const { id } = parse(idParam, req.params);
      const { rows } = await ctx.db.query("SELECT factory_id, file_name, file_data FROM uploads WHERE id = $1", [id]);
      const row = rows[0];
      if (!row) throw new AppError("REQ-002");
      await assertFactoryAccess(ctx.db, user, row.factory_id);
      return new BinaryResponse(new Uint8Array(row.file_data), XLSX_TYPE, String(row.file_name));
    },
  },
];
