# LlvPglite

Ecto in the browser for [LocalLiveView](https://popcorn.swmansion.com): a
local view's repo runs the host app's own schemas and `priv/repo/migrations`
against PGlite (Postgres compiled to Wasm), in a Web Worker in the same tab,
persisted to IndexedDB.

- `LlvPglite.Repo`: `use` it for the repo in `local/`. Gives `migrate!/0`,
  which runs new migrations in place and wipes and reseeds when a migration
  that already ran was edited or deleted (fingerprints in
  `llv_migration_fingerprints`).
- `LlvPglite.Migrations`: compiles the host's migration files into the bundle.
- `LlvPglite.Adapter`: Postgres SQL from Ecto's own generator, run in PGlite.
- `mix llv.manifest`: writes the `live_local` routes as JSON, for hosting the
  static shell without the Phoenix server.
- `priv/static/pglite/`: PGlite and its worker. The host serves it at `/pglite`:

      plug Plug.Static, at: "/pglite", from: {:llv_pglite, "priv/static/pglite"}

- `priv/static/llv_pglite.js`: the main-thread bridge; `import "llv_pglite"` in app.js.

Keep it out of the Wasm bundle with `exclude_priv: [llv_pglite: "*"]` in the
`:popcorn` config.

## Vendored

`vendor/local_live_view` and `vendor/popcorn` are patched copies; see each
`VENDORED.md`. LocalLiveView's TypeScript sources and node_modules are left
out: its prebuilt `priv/static/local_live_view.js` ships instead.

## License

Apache-2.0. The vendored LocalLiveView and Popcorn are Apache-2.0 by Software Mansion; patches to them are listed in their `VENDORED.md`.
