# Vendored Popcorn

`elixir/` is the Hex package `popcorn` 1.0.2, copied from `deps/popcorn`
(its `.hex` checksum file removed). `vendor/local_live_view/mix.exs` uses it as
a path dependency whenever this directory exists.

## Local patches

- `lib/popcorn/packager.ex` `compress/2`: gzip and brotli outputs are cached by
  sha256 of the input in `_build/<target>_<env>/popcorn_compress_cache/`, so a
  rebuild recompresses only the files that changed. With tree-shaking off (dev),
  that's only the app bundle: the runtime, stdlib and deps are byte-identical
  between rebuilds. The cache is never evicted.
