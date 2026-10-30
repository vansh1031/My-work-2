// Browser mode (and tests): wraps PGlite, PostgreSQL compiled to run inside the browser, as a Db.
// Written against PGlite's method shapes only, so core/ does not depend on the PGlite package itself.
import type { Db, Queryable } from "./db.js";

interface PgliteResults {
  rows: unknown[];
  affectedRows?: number;
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
      return { rows: res.rows as never[], rowCount: res.affectedRows || res.rows.length };
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

/** Options every PGlite instance must use so results match node-postgres (dates as "YYYY-MM-DD" text). */
export const PGLITE_PARSERS = { 1082: (value: string) => value };
