// Startup steps shared by both modes: create the tables, make sure an admin exists, add sample data if asked.
import type { Db, Migration } from "./db.js";
import { runMigrations } from "./db.js";
import { hashPassword } from "./auth/passwords.js";
import { seedSampleData } from "./sample-data.js";

/** On a brand new database, creates user "admin" with the given password. It must be changed at first sign-in. */
export async function ensureAdmin(db: Db, initialPassword: string) {
  const { rows } = await db.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (rows.length) return;
  await db.query(
    `INSERT INTO users (username, display_name, password_hash, role, can_update_status, must_change_password)
     VALUES ('admin', 'Administrator', $1, 'admin', TRUE, TRUE)`,
    [await hashPassword(initialPassword)],
  );
}

export async function prepareDatabase(
  db: Db,
  migrations: Migration[],
  opts: { initialAdminPassword: string; seedSampleData: boolean },
): Promise<{ sampleDataAdded: boolean }> {
  await runMigrations(db, migrations);
  await ensureAdmin(db, opts.initialAdminPassword);
  const sampleDataAdded = opts.seedSampleData ? await seedSampleData(db) : false;
  return { sampleDataAdded };
}
