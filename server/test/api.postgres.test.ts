import { describe } from "vitest";
import pg from "pg";
import { runApiSuite } from "./api-suite.js";
import { TEST_DB_URL } from "./helpers.js";

// Runs only where PostgreSQL is reachable (CI, or a developer machine with PostgreSQL). The same suite always runs
// on PGlite (api.pglite.test.ts), so the backend is still fully tested without PostgreSQL.
async function postgresReachable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: TEST_DB_URL, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    if (process.env.TEST_DATABASE_URL) throw new Error(`TEST_DATABASE_URL is set but PostgreSQL is not reachable at it.`);
    console.warn(`PostgreSQL not reachable at ${TEST_DB_URL}: the PostgreSQL run of the API suite is skipped.`);
    return false;
  }
}

describe.skipIf(!(await postgresReachable()))("API on postgres", () => runApiSuite("postgres"));
