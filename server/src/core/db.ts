// The database as the rest of the code sees it. Two implementations exist:
//   server mode:  node-postgres connected to a PostgreSQL server   (server/src/node/pg-db.ts)
//   browser mode: PGlite, PostgreSQL running inside the browser     (web/src/local-backend/pglite-db.ts)
// Both run the same SQL, so every query in core/ works the same in both modes.

export interface QueryResult<T> {
  rows: T[];
  /** Rows changed (INSERT/UPDATE/DELETE) or returned (SELECT). */
  rowCount: number;
}

export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  /** Runs several statements separated by semicolons, without parameters (used for migrations). */
  exec(sql: string): Promise<void>;
  /** Runs fn inside a transaction: everything is saved together, or nothing is. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

export interface Migration {
  name: string;
  sql: string;
}

/** Applies any migration that has not run yet, in name order. Each runs in its own transaction. */
export async function runMigrations(db: Db, migrations: Migration[]): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const done = new Set((await db.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(m.name)) continue;
    await db.exec(`BEGIN;\n${m.sql}\nINSERT INTO schema_migrations (name) VALUES ('${m.name.replace(/'/g, "''")}');\nCOMMIT;`);
    applied.push(m.name);
  }
  return applied;
}
