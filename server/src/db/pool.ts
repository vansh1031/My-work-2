import pg from "pg";

// Return DATE columns as plain "YYYY-MM-DD" strings. Converting them to JavaScript dates would shift
// them by the server's time zone and show the wrong day.
pg.types.setTypeParser(1082, (value) => value);

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

/** Runs fn inside a transaction: everything is saved together, or nothing is. */
export async function withTransaction<T>(db: Db, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
