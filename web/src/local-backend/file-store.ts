// Browser mode: factory photos and 3D models are kept in a table of the browser database.
import type { Db } from "../../../server/src/core/db";
import type { FileStore } from "../../../server/src/core/services/files";

export async function dbFileStore(db: Db): Promise<FileStore> {
  await db.exec("CREATE TABLE IF NOT EXISTS local_files (name TEXT PRIMARY KEY, data BYTEA NOT NULL)");
  return {
    async save(name, data) {
      await db.query("INSERT INTO local_files (name, data) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data", [name, data]);
    },
    async read(name) {
      const { rows } = await db.query<{ data: Uint8Array }>("SELECT data FROM local_files WHERE name = $1", [name]);
      return rows[0] ? new Uint8Array(rows[0].data) : null;
    },
    async delete(name) {
      await db.query("DELETE FROM local_files WHERE name = $1", [name]);
    },
  };
}
