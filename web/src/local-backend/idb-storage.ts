// Keeps the browser database's files in IndexedDB.
//
// PGlite runs PostgreSQL on an in-memory file system. Its "memfs frontend" records which files each query changed and
// hands exactly those changes to a storage backend; this is that backend. Files are stored as 64 KB blocks, so a small
// change to a large file (PostgreSQL's 16 MB log segments) writes only the blocks it touched. PGlite never calls apply()
// twice at once, and if apply() fails it keeps the changes and passes them again with the next query.
// See docs/decisions.md D-033 for why this replaced PGlite's built-in "idb://" storage.
import type { ChangeSet, FileWrite, StorageBackend, StorageEntry } from "@electric-sql/pglite/memfs-frontend";

const BLOCK = 64 * 1024;
const META = "meta"; // path -> { kind: "dir" } | { kind: "file", size }
const BLOCKS = "blocks"; // [path, blockIndex] -> Uint8Array of BLOCK bytes (the file size in META says how much is used)

type Meta = { kind: "dir" } | { kind: "file"; size: number };

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/** Everything inside a folder (not the folder itself). */
const insideMeta = (path: string) => IDBKeyRange.bound(`${path}/`, `${path}/￿`);
const blocksOf = (path: string) => IDBKeyRange.bound([path, 0], [path, Infinity]);
const blocksInside = (path: string) => IDBKeyRange.bound([`${path}/`], [`${path}/￿`]);

export class IdbStorage implements StorageBackend {
  #db: IDBDatabase | null = null;

  constructor(readonly name: string) {}

  async init(): Promise<void> {
    const open = indexedDB.open(this.name, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(META);
      open.result.createObjectStore(BLOCKS);
    };
    this.#db = await request(open);
  }

  get db(): IDBDatabase {
    if (!this.#db) throw new Error("IdbStorage used before init()");
    return this.#db;
  }

  async *load(): AsyncIterable<StorageEntry> {
    const tx = this.db.transaction([META, BLOCKS], "readonly");
    const paths = (await request(tx.objectStore(META).getAllKeys())) as string[];
    const metas = (await request(tx.objectStore(META).getAll())) as Meta[];
    const entries = paths.map((path, i) => ({ path, meta: metas[i]! })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const files: StorageEntry[] = [];
    for (const { path, meta } of entries) {
      if (meta.kind === "dir") {
        files.push({ kind: "dir", path });
        continue;
      }
      const keys = (await request(tx.objectStore(BLOCKS).getAllKeys(blocksOf(path)))) as [string, number][];
      const blocks = (await request(tx.objectStore(BLOCKS).getAll(blocksOf(path)))) as Uint8Array[];
      const data = new Uint8Array(meta.size);
      keys.forEach(([, index], i) => {
        const start = index * BLOCK;
        if (start < meta.size) data.set(blocks[i]!.subarray(0, Math.min(BLOCK, meta.size - start)), start);
      });
      files.push({ kind: "file", path, data });
    }
    // Sorted by path, so every folder comes before what is inside it.
    yield* files;
  }

  async apply(changes: ChangeSet, { relaxedDurability }: { relaxedDurability: boolean }): Promise<void> {
    const tx = this.db.transaction([META, BLOCKS], "readwrite", { durability: relaxedDurability ? "relaxed" : "strict" });
    const finished = done(tx);
    const meta = tx.objectStore(META);
    const blocks = tx.objectStore(BLOCKS);
    try {
      for (const op of changes.ops) {
        if (op.op === "mkdir") {
          meta.put({ kind: "dir" } satisfies Meta, op.path);
        } else {
          meta.delete(op.path);
          meta.delete(insideMeta(op.path));
          blocks.delete(blocksOf(op.path));
          blocks.delete(blocksInside(op.path));
        }
      }
      // Same order as PGlite's own storage: log files, then data files, then the control file last.
      for (const write of [...changes.files.wal, ...changes.files.data, ...changes.files.control]) {
        await this.#writeFile(meta, blocks, write);
      }
    } catch (err) {
      tx.abort();
      await finished.catch(() => undefined);
      throw err;
    }
    await finished;
  }

  async #writeFile(meta: IDBObjectStore, blocks: IDBObjectStore, write: FileWrite): Promise<void> {
    const old = (await request(meta.get(write.path))) as Meta | undefined;
    let size = !write.full && old?.kind === "file" ? old.size : 0;
    const changed = new Map<number, Uint8Array>();
    const block = async (index: number): Promise<Uint8Array> => {
      let b = changed.get(index);
      if (!b) {
        const stored = write.full ? undefined : ((await request(blocks.get([write.path, index]))) as Uint8Array | undefined);
        b = stored ? new Uint8Array(stored) : new Uint8Array(BLOCK);
        changed.set(index, b);
      }
      return b;
    };

    if (write.full) {
      blocks.delete(blocksOf(write.path));
    } else if (write.truncate && write.size < size) {
      // Drop whole blocks past the new end, and zero the rest of the last block so a later extension reads zeros.
      const lastIndex = Math.floor(write.size / BLOCK);
      blocks.delete(IDBKeyRange.bound([write.path, lastIndex + 1], [write.path, Infinity]));
      const offset = write.size - lastIndex * BLOCK;
      if (offset > 0) (await block(lastIndex)).fill(0, offset);
      else blocks.delete([write.path, lastIndex]);
      size = write.size;
    } else if (write.truncate) {
      size = write.size;
    }

    for (const chunk of write.chunks) {
      let pos = chunk.at;
      let from = 0;
      while (from < chunk.data.length) {
        const index = Math.floor(pos / BLOCK);
        const offset = pos - index * BLOCK;
        const n = Math.min(BLOCK - offset, chunk.data.length - from);
        (await block(index)).set(chunk.data.subarray(from, from + n), offset);
        pos += n;
        from += n;
      }
      size = Math.max(size, chunk.at + chunk.data.length);
    }
    if (write.full) size = Math.max(size, write.size);

    for (const [index, data] of changed) {
      if (index * BLOCK < size) blocks.put(data, [write.path, index]);
    }
    meta.put({ kind: "file", size } satisfies Meta, write.path);
  }

  async close(): Promise<void> {
    this.#db?.close();
    this.#db = null;
  }
}
