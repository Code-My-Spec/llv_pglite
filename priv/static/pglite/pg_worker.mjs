// PGlite's IndexedDB filesystem leaves one ENOENT (errno 44) rejection
// unhandled when it boots a brand-new database; the database is fine. Keep it
// out of the page's console. Any other rejection still surfaces.
self.addEventListener("unhandledrejection", (e) => {
  if (e.reason?.name === "ErrnoError" && e.reason?.errno === 44) e.preventDefault();
});

// PGlite (Postgres 19 in Wasm) in a dedicated Web Worker, persisted to IndexedDB.
//
// Protocol: {id, op, sql, params} in -> {id, ok, result | error} out.
//   op "query" (default): result = {columns, types, rows, affectedRows}
//   op "info":            result = {version, storage, bootMs}
//   op "reset":           drops the whole database and boots a fresh one
//
// Values come back as Postgres text with each column's type OID; the BEAM side
// (Local.PGlite) decodes them the way Postgrex would.
import { PGlite, types } from "./index.js";

const NAME = "llv-pglite";
const DATA_DIR = `idb://${NAME}`;
const raw = Object.fromEntries(Object.keys(types.parsers).map((oid) => [oid, (x) => x]));

const boot = async () => {
  const t0 = performance.now();
  const db = await PGlite.create(DATA_DIR, { parsers: raw, relaxedDurability: true });
  await db.exec("SET TIME ZONE 'UTC'");
  const bootMs = performance.now() - t0;
  const { rows } = await db.query("SHOW server_version");
  return { db, bootMs, version: rows[0].server_version };
};

let ready = boot();

// IDBFS names its database after the mount path, so match on the name.
const dropStorage = async () => {
  const names = (await indexedDB.databases()).map((d) => d.name).filter((n) => n?.includes(NAME));
  await Promise.all(names.map((name) => new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  })));
  return names;
};

const reset = async () => {
  const { db } = await ready.catch(() => ({}));
  await db?.close();
  const dropped = await dropStorage();
  ready = boot();
  const { bootMs } = await ready;
  return { dropped, bootMs };
};

const errorFields = (e) => ({
  message: String(e?.message ?? e), code: e?.code, constraint: e?.constraint, table: e?.table,
  column: e?.column, schema: e?.schema, detail: e?.detail, hint: e?.hint, severity: e?.severity,
});

// One at a time: a reset must not interleave with queries.
let queue = Promise.resolve();

self.onmessage = ({ data: { id, op, sql, params } }) => {
  queue = queue.then(async () => {
    try {
      let result;
      if (op === "reset") {
        result = await reset();
      } else {
        const { db, bootMs, version } = await ready;
        if (op === "info") {
          result = { version, storage: DATA_DIR, bootMs };
        } else {
          const r = await db.query(sql, params, { rowMode: "array" });
          result = { columns: r.fields.map((f) => f.name), types: r.fields.map((f) => f.dataTypeID),
                     rows: r.rows, affectedRows: r.affectedRows ?? 0 };
        }
      }
      self.postMessage({ id, ok: true, result });
    } catch (e) {
      self.postMessage({ id, ok: false, error: errorFields(e) });
    }
  });
};
