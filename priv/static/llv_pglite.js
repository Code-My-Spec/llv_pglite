// Main-thread handle to the PGlite worker (priv/static/pglite/pg_worker.mjs,
// served by the host at /pglite). Import it once from app.js:
//
//     import "llv_pglite"
//
// Elixir in Popcorn reaches it with
//   Popcorn.JS.run("({sql, params}) => window.BrowserPG.query(sql, params)", ...)
// which awaits the returned promise (see LlvPglite.PGlite). Rejections carry
// the Postgres error fields as JSON so Elixir can rebuild a Postgrex.Error.
let worker
let seq = 0
const pending = new Map()

function send(msg) {
  if (!worker) {
    worker = new Worker("/pglite/pg_worker.mjs", {type: "module"})
    worker.onmessage = ({data: {id, ok, result, error}}) => {
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      ok ? p.resolve(result) : p.reject(new Error(JSON.stringify(error)))
    }
    // A worker that failed to load or crashed answers nothing: fail what's
    // waiting now rather than at the Elixir side's timeout, and start a new
    // worker on the next call.
    worker.onerror = (e) => {
      const error = new Error(JSON.stringify({message: `PGlite worker failed: ${e.message || "load error"}`}))
      for (const p of pending.values()) p.reject(error)
      pending.clear()
      worker = undefined
    }
  }
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject})
    worker.postMessage({id, ...msg})
  })
}

window.BrowserPG = {
  query: (sql, params = []) => send({op: "query", sql, params}),
  info: () => send({op: "info"}),
  reset: () => send({op: "reset"}),
}
