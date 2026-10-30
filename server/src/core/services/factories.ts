// Database reads for factories, machines and status. Route handlers call these; nothing here checks permissions.
import type { CurrentStatus, FactorySummary, Machine, MachineStatus, StatusCounts, StatusRecord } from "@fa/shared";
import type { Db } from "../db.js";
import { fileUrl } from "./files.js";

interface FactoryRow {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  shifts_per_day: number;
  photo_file: string | null;
  is_sample: boolean;
}

// Latest effective record per machine: newest day first, then the latest shift of that day.
const CURRENT_STATUS_SQL = `
  SELECT DISTINCT ON (es.machine_id) es.machine_id, es.status, es.work_date, es.shift, es.abort_count, es.source, es.created_at
  FROM effective_status es
  ORDER BY es.machine_id, es.work_date DESC, es.shift DESC`;

function emptyCounts(): StatusCounts {
  return { running: 0, stopped: 0, aborted: 0, shift_ended: 0, unknown: 0 };
}

function toSummary(row: FactoryRow, machineCount: number, counts: StatusCounts): FactorySummary {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    shiftsPerDay: row.shifts_per_day,
    photoUrl: fileUrl(row.photo_file),
    isSample: row.is_sample,
    machineCount,
    statusCounts: counts,
  };
}

export async function listFactories(db: Db, user: { id: number; role: string }, ids?: number[]): Promise<FactorySummary[]> {
  const { rows } = await db.query<FactoryRow>(
    `SELECT f.* FROM factories f
     WHERE NOT f.archived
       AND ($2 OR EXISTS (SELECT 1 FROM user_factories uf WHERE uf.factory_id = f.id AND uf.user_id = $1))
       AND ($3::int[] IS NULL OR f.id = ANY($3))
     ORDER BY f.name`,
    [user.id, user.role === "admin", ids ?? null],
  );
  if (rows.length === 0) return [];
  const counts = await db.query<{ factory_id: number; status: MachineStatus | null; n: string }>(
    `SELECT m.factory_id, cs.status, count(*) AS n
     FROM machines m LEFT JOIN (${CURRENT_STATUS_SQL}) cs ON cs.machine_id = m.id
     WHERE NOT m.archived AND m.factory_id = ANY($1)
     GROUP BY m.factory_id, cs.status`,
    [rows.map((r) => r.id)],
  );
  const byFactory = new Map<number, { total: number; counts: StatusCounts }>();
  for (const c of counts.rows) {
    const entry = byFactory.get(c.factory_id) ?? { total: 0, counts: emptyCounts() };
    entry.total += Number(c.n);
    entry.counts[c.status ?? "unknown"] += Number(c.n);
    byFactory.set(c.factory_id, entry);
  }
  return rows.map((r) => {
    const entry = byFactory.get(r.id);
    return toSummary(r, entry?.total ?? 0, entry?.counts ?? emptyCounts());
  });
}

export async function getFactoryRow(db: Db, id: number): Promise<FactoryRow | null> {
  const { rows } = await db.query<FactoryRow>("SELECT * FROM factories WHERE id = $1 AND NOT archived", [id]);
  return rows[0] ?? null;
}

interface MachineRow {
  id: number;
  factory_id: number;
  code: string;
  name: string;
  machine_type: string;
  description: string;
  model_file: string | null;
  status: MachineStatus | null;
  work_date: string | null;
  shift: number | null;
  abort_count: number | null;
  source: "upload" | "manual" | null;
  created_at: Date | null;
}

function toMachine(row: MachineRow): Machine {
  const current: CurrentStatus | null = row.status
    ? {
        status: row.status,
        workDate: row.work_date!,
        shift: row.shift!,
        abortCount: row.abort_count ?? 0,
        source: row.source!,
        updatedAt: row.created_at!.toISOString(),
      }
    : null;
  return {
    id: row.id,
    factoryId: row.factory_id,
    code: row.code,
    name: row.name,
    machineType: row.machine_type,
    description: row.description,
    modelUrl: fileUrl(row.model_file),
    current,
  };
}

export async function listMachines(db: Db, factoryId: number): Promise<Machine[]> {
  const { rows } = await db.query<MachineRow>(
    `SELECT m.*, cs.status, cs.work_date, cs.shift, cs.abort_count, cs.source, cs.created_at
     FROM machines m LEFT JOIN (${CURRENT_STATUS_SQL}) cs ON cs.machine_id = m.id
     WHERE m.factory_id = $1 AND NOT m.archived
     ORDER BY m.code`,
    [factoryId],
  );
  return rows.map(toMachine);
}

export async function getMachine(db: Db, machineId: number): Promise<Machine | null> {
  const { rows } = await db.query<MachineRow>(
    `SELECT m.*, cs.status, cs.work_date, cs.shift, cs.abort_count, cs.source, cs.created_at
     FROM machines m LEFT JOIN (${CURRENT_STATUS_SQL}) cs ON cs.machine_id = m.id
     WHERE m.id = $1 AND NOT m.archived`,
    [machineId],
  );
  return rows[0] ? toMachine(rows[0]) : null;
}

export async function listStatusRecords(
  db: Db,
  opts: { factoryId: number; from: string; to: string; machineId?: number },
): Promise<StatusRecord[]> {
  const { rows } = await db.query<{
    machine_id: number; work_date: string; shift: number; status: MachineStatus; abort_count: number;
    remarks: string; source: "upload" | "manual"; created_at: Date; created_by: string;
  }>(
    `SELECT es.machine_id, es.work_date, es.shift, es.status, es.abort_count, es.remarks, es.source, es.created_at,
            u.display_name AS created_by
     FROM effective_status es
     JOIN machines m ON m.id = es.machine_id
     JOIN users u ON u.id = es.created_by
     WHERE m.factory_id = $1 AND NOT m.archived AND es.work_date BETWEEN $2 AND $3
       AND ($4::int IS NULL OR es.machine_id = $4)
     ORDER BY es.work_date DESC, es.shift DESC, m.code`,
    [opts.factoryId, opts.from, opts.to, opts.machineId ?? null],
  );
  return rows.map((r) => ({
    machineId: r.machine_id,
    workDate: r.work_date,
    shift: r.shift,
    status: r.status,
    abortCount: r.abort_count,
    remarks: r.remarks,
    source: r.source,
    createdAt: r.created_at.toISOString(),
    createdBy: r.created_by,
  }));
}
