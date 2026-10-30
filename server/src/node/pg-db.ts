// Server mode: the database is a PostgreSQL server, reached with node-postgres.
import pg from "pg";
import type { Db, Queryable } from "../core/db.js";

// Return DATE columns as plain "YYYY-MM-DD" strings. Converting them to JavaScript dates would shift
// them by the server's time zone and show the wrong day.
pg.types.setTypeParser(1082, (value) => value);

/** Plain Uint8Arrays become Buffers, which node-postgres stores as bytea. */
function toPgParams(params?: unknown[]) {
  return params?.map((p) => (p instanceof Uint8Array && !Buffer.isBuffer(p) ? Buffer.from(p) : p));
}

function wrap(client: pg.Pool | pg.PoolClient): Queryable {
  return {
    async query(sql, params) {
      const res = await client.query(sql, toPgParams(params));
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    },
  };
}

export interface PgDb extends Db {
  end(): Promise<void>;
}

export function createPgDb(databaseUrl: string): PgDb {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return {
    ...wrap(pool),
    async exec(sql) {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(wrap(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}
