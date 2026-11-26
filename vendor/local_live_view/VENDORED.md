# Vendored LocalLiveView

Source: https://github.com/software-mansion/popcorn, directory `local-live-view/`
Pinned commit: 67dc868ae144a1ab0e83b1a4ec51873eb677fe90 (last change to local-live-view: 330d6ad, 2026-11-20)
`lib/` is byte-identical to that commit, except the patch below. `priv/static/local_live_view.js` was built from `assets/`, which is left out of this copy (upstream does not commit the bundle). LICENSE is upstream's Apache-2.0 (copied from Popcorn, same repo).

Do not use Hex `local_live_view` 0.1.0: it targets Popcorn 0.3.3 (AtomVM), not Popcorn 1.0 (BEAM/OTP 29).

## Local patches

- `lib/server/router.ex`: `live_local` also puts the view name in route
  `metadata` (`%{llv_view: "..."}`). `Router.__routes__/0` drops `:private`,
  and `mix llv.manifest` needs the view to write the static-hosting route
  manifest. Worth upstreaming.
