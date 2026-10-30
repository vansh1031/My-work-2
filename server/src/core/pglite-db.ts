// Browser mode (and tests): wraps PGlite, PostgreSQL compiled to run inside the browser, as a Db.
// Written against PGlite's method shapes only, so core/ does not depend on the PGlite package itself.
import type { Db, Queryable } from "./db.js";

interface PgliteResults {
  rows: unknown[];
  affectedRows?: number;
  fields?: { name: string; dataTypeID: number }[];
}

const DATE_TYPE = 1082;

/** DATE columns become "YYYY-MM-DD" text, as node-postgres is set up to return them (see node/pg-db.ts). */
function fixDates(res: PgliteResults): unknown[] {
  const dateFields = (res.fields ?? []).filter((f) => f.dataTypeID === DATE_TYPE).map((f) => f.name);
  if (dateFields.length === 0) return res.rows;
  return res.rows.map((row) => {
    const copy = { ...(row as Record<string, unknown>) };
    for (const name of dateFields) {
      const v = copy[name];
      if (v instanceof Date) copy[name] = v.toISOString().slice(0, 10);
    }
    return copy;
  });
}

interface PgliteQueryable {
  query(sql: string, params?: unknown[]): Promise<PgliteResults>;
}

export interface PgliteLike extends PgliteQueryable {
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: PgliteQueryable) => Promise<T>): Promise<T>;
}


function wrap(q: PgliteQueryable): Queryable {
  return {
    async query(sql, params) {
      const res = await q.query(sql, params);
      // PGlite reports changed rows for INSERT/UPDATE/DELETE and 0 for SELECT; node-postgres reports rows returned.
      return { rows: fixDates(res) as never[], rowCount: res.affectedRows || res.rows.length };
    },
  };
}

export function pgliteDb(pg: PgliteLike): Db {
  return {
    ...wrap(pg),
    async exec(sql) {
      try {
        await pg.exec(sql);
      } catch (err) {
        await pg.exec("ROLLBACK").catch(() => undefined);
        throw err;
      }
    },
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
  };
}
