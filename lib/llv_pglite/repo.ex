defmodule LlvPglite.Repo do
  @moduledoc """
  An Ecto repo that lives in the browser and executes in this tab's PGlite.

      defmodule MyLocal.Repo do
        use LlvPglite.Repo,
          otp_app: :local,
          migrations: MyLocal.Migrations,
          seeds: MyLocal.Seeds
      end

  `:migrations` is a module that uses `LlvPglite.Migrations`. `:seeds` is
  optional: a module with `run(repo)`, called on an empty database.

  The repo gets `migrate!/0`, which brings the tab's database up to the
  migrations, in place:

    * New migrations run against the existing data, as on a real server.
    * If a migration that already ran was edited or deleted, the data was
      built by code that no longer exists, so the database is wiped and every
      migration runs again from scratch.
    * An empty database (first visit, or after a wipe) gets the seeds.

  It returns `%{ran: [version], reset?: boolean, seeded?: boolean}`.
  """

  alias LlvPglite.PGlite

  defmacro __using__(opts) do
    {otp_app, opts} = Keyword.pop!(opts, :otp_app)
    {migrations, opts} = Keyword.pop!(opts, :migrations)
    {seeds, []} = Keyword.pop(opts, :seeds)

    quote do
      use Ecto.Repo, otp_app: unquote(otp_app), adapter: LlvPglite.Adapter

      @doc "Brings this tab's database up to the app's migrations. See `LlvPglite.Repo`."
      def migrate!, do: LlvPglite.Repo.migrate!(__MODULE__, unquote(migrations), unquote(seeds))
    end
  end

  @doc false
  def migrate!(repo, migrations, seeds) do
    current = Map.new(migrations.all(), fn {v, _mod, fp} -> {v, fp} end)
    applied = applied()

    reset? = Enum.any?(applied, fn {v, fp} -> current[v] != fp end)
    if reset?, do: PGlite.reset!()
    fresh? = reset? or applied == %{}

    to_run = for {v, mod, _} <- migrations.all(), do: {v, mod}
    ran = Ecto.Migrator.run(repo, to_run, :up, all: true, log: false)
    record(Map.take(current, ran))

    seeded? = fresh? and seeds != nil
    if seeded?, do: seeds.run(repo)
    %{ran: ran, reset?: reset?, seeded?: seeded?}
  end

  # Applied versions with the fingerprint each ran with (nil when unknown,
  # which counts as edited).
  defp applied do
    ensure_fingerprints_table!()

    case PGlite.query(
           "SELECT m.version, f.fingerprint FROM schema_migrations m LEFT JOIN llv_migration_fingerprints f USING (version)",
           []
         ) do
      {:ok, %{rows: rows}} -> Map.new(rows, fn [v, fp] -> {v, fp} end)
      # No schema_migrations yet: nothing has run.
      {:error, %Postgrex.Error{postgres: %{pg_code: "42P01"}}} -> %{}
    end
  end

  defp record(fingerprints) do
    # Again here: a reset since applied/0 dropped it.
    ensure_fingerprints_table!()

    for {v, fp} <- fingerprints do
      q!(
        "INSERT INTO llv_migration_fingerprints VALUES ($1, $2) ON CONFLICT (version) DO UPDATE SET fingerprint = EXCLUDED.fingerprint",
        [v, fp]
      )
    end
  end

  defp ensure_fingerprints_table! do
    q!(
      "CREATE TABLE IF NOT EXISTS llv_migration_fingerprints (version bigint PRIMARY KEY, fingerprint text NOT NULL)"
    )
  end

  defp q!(sql, params \\ []) do
    {:ok, result} = PGlite.query(sql, params)
    result
  end
end
