defmodule LlvPglite.Migrations do
  @moduledoc """
  Compiles the host app's migrations into the browser bundle.

  Popcorn can't load `.exs` files at runtime, so each file in the directory is
  compiled into the module that uses this one, at build time, unchanged:

      defmodule MyLocal.Migrations do
        use LlvPglite.Migrations, path: "../../../priv/repo/migrations"
      end

  `:path` is relative to the file with the `use`.

  Each migration also gets a fingerprint: a hash of its code with formatting,
  comments and line numbers stripped. `LlvPglite.Repo` compares it with the
  one recorded when the migration ran, to tell an edited migration (wipe and
  start over) from a new one (just run it).

  The using module gets `all/0`, `[{version, module, fingerprint}]`, oldest first.
  """

  defmacro __using__(opts) do
    path = Keyword.fetch!(opts, :path)
    dir = Path.expand(path, Path.dirname(__CALLER__.file))

    quote bind_quoted: [dir: dir] do
      @llv_dir dir
      @llv_files @llv_dir |> Path.join("*.exs") |> Path.wildcard() |> Enum.sort()

      for file <- @llv_files, do: @external_resource(file)

      @llv_migrations Enum.map(@llv_files, &LlvPglite.Migrations.compile!/1)

      @doc "`[{version, module, fingerprint}]`, oldest first."
      def all, do: @llv_migrations

      # A migration added or removed since the last build changes the file
      # list, which @external_resource alone does not catch.
      def __mix_recompile__?,
        do: @llv_dir |> Path.join("*.exs") |> Path.wildcard() |> Enum.sort() != @llv_files
    end
  end

  @doc false
  def compile!(file) do
    source = File.read!(file)
    [{mod, _}] = Code.compile_string(source, file)
    version = file |> Path.basename() |> Integer.parse() |> elem(0)
    {version, mod, fingerprint(source)}
  end

  @doc "The migration's code with formatting, comments and line numbers stripped, hashed."
  def fingerprint(source) do
    source
    |> Code.string_to_quoted!()
    |> Macro.prewalk(&Macro.update_meta(&1, fn _ -> [] end))
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
    |> binary_part(0, 16)
  end
end
