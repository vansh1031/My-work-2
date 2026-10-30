// The browser version keeps its database files in IndexedDB through web/src/local-backend/idb-storage.ts.
// This test runs that storage on a simulated IndexedDB: create the database, change data, close, reopen, compare.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MemfsFrontendFS } from "@electric-sql/pglite/memfs-frontend";
import { IdbStorage } from "../../web/src/local-backend/idb-storage.js";
import { pgliteDb } from "../src/core/pglite-db.js";
import { prepareDatabase } from "../src/core/setup.js";
import { readMigrations } from "../src/node/migrations.js";

async function open(name: string) {
  const pg = await PGlite.create({ fs: new MemfsFrontendFS(new IdbStorage(name)) });
  return { pg, db: pgliteDb(pg) };
}

async function snapshot(db: ReturnType<typeof pgliteDb>) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    counts: await q(
      "SELECT (SELECT count(*) FROM factories) AS f, (SELECT count(*) FROM machines) AS m, (SELECT count(*) FROM status_records) AS s, (SELECT count(*) FROM users) AS u",
    ),
    users: await q("SELECT username, password_hash, must_change_password FROM users ORDER BY username"),
    latest: await q("SELECT machine_id, work_date, shift, status FROM effective_status ORDER BY machine_id, work_date DESC, shift DESC LIMIT 5"),
  };
}

describe("browser database storage (IndexedDB)", () => {
  it("keeps every change after closing and reopening", async () => {
    const first = await open("fa-test-1");
    await prepareDatabase(first.db, readMigrations(), { initialAdminPassword: "first-pass", seedSampleData: true });
    await first.db.query("UPDATE users SET must_change_password = FALSE, display_name = 'Changed' WHERE username = 'admin'");
    await first.db.transaction(async (tx) => {
      await tx.query("INSERT INTO audit_log (user_id, action) VALUES (1, 'test')");
      await tx.query("UPDATE factories SET name = name || ' (renamed)' WHERE id = 1");
    });
    // A large value spans several 64 KB blocks.
    const big = new Uint8Array(300_000).map((_, i) => i % 251);
    await first.db.query(
      "INSERT INTO uploads (factory_id, work_date, file_name, file_data, file_size, row_count, uploaded_by) VALUES (1, '2026-10-01', 'big.xlsx', $1, $2, 0, 1)",
      [big, big.length],
    );
    const before = await snapshot(first.db);
    await first.pg.close();

    const second = await open("fa-test-1");
    const after = await snapshot(second.db);
    expect(after).toEqual(before);
    expect((await second.db.query("SELECT name FROM factories WHERE id = 1")).rows[0].name).toMatch(/\(renamed\)$/);
    const stored = (await second.db.query("SELECT file_data FROM uploads WHERE file_name = 'big.xlsx'")).rows[0].file_data as Uint8Array;
    expect(stored.length).toBe(big.length);
    expect(Buffer.from(stored).equals(Buffer.from(big))).toBe(true);
    // Reopening must not run setup again or add sample data twice.
    await prepareDatabase(second.db, readMigrations(), { initialAdminPassword: "x", seedSampleData: true });
    expect(await snapshot(second.db)).toEqual(before);
    await second.pg.close();
  });

  it("a second database name is a separate, empty database", async () => {
    const other = await open("fa-test-2");
    await prepareDatabase(other.db, readMigrations(), { initialAdminPassword: "p", seedSampleData: false });
    expect((await other.db.query("SELECT count(*) AS n FROM factories")).rows[0].n).toBe(0);
    await other.pg.close();
  });
});
