defmodule LlvPglite.Adapter do
  @moduledoc """
  An Ecto adapter for code running in the browser (Popcorn): it generates
  Postgres SQL with `Ecto.Adapters.Postgres.Connection` (pure Elixir) and runs
  it in this tab's PGlite, through `LlvPglite.PGlite`.

  Because the SQL generator is the real Postgres one, the host app's schemas,
  queries and `priv/repo/migrations` run unchanged.

  Not supported: transactions, streams.
  """
  @behaviour Ecto.Adapter
  @behaviour Ecto.Adapter.Queryable
  @behaviour Ecto.Adapter.Schema
  @behaviour Ecto.Adapter.Migration

  alias LlvPglite.PGlite

  @conn Ecto.Adapters.Postgres.Connection

  ## Adapter

  @impl true
  defmacro __before_compile__(_env), do: :ok

  @impl true
  def ensure_all_started(_config, _type), do: {:ok, []}

  @impl true
  def init(config) do
    # Nothing to supervise: there is no pool, just the worker on the JS side.
    child = %{id: {__MODULE__, config[:repo]}, start: {Agent, :start_link, [fn -> nil end]}}
    {:ok, child, %{}}
  end

  @impl true
  def checkout(_meta, _opts, fun), do: fun.()

  @impl true
  def checked_out?(_meta), do: false

  # Same type handling as Ecto.Adapters.Postgres.
  @impl true
  def loaders({:map, _}, type), do: [&Ecto.Type.embedded_load(type, &1, :json)]
  def loaders(:binary_id, type), do: [Ecto.UUID, type]
  def loaders(_, type), do: [type]

  @impl true
  def dumpers({:map, _}, type), do: [&Ecto.Type.embedded_dump(type, &1, :json)]
  def dumpers({:in, sub}, {:in, sub}), do: [{:array, sub}]
  def dumpers(:binary_id, type), do: [type, Ecto.UUID]
  def dumpers(_, type), do: [type]

  ## Queryable

  @impl true
  def prepare(:all, query), do: {:cache, {id(), IO.iodata_to_binary(@conn.all(query))}}

  def prepare(:update_all, query),
    do: {:cache, {id(), IO.iodata_to_binary(@conn.update_all(query))}}

  def prepare(:delete_all, query),
    do: {:cache, {id(), IO.iodata_to_binary(@conn.delete_all(query))}}

  @impl true
  def execute(_meta, _query_meta, prepared, params, _opts) do
    sql =
      case prepared do
        {:nocache, {_id, sql}} -> sql
        {:cache, update, {id, sql}} -> update.({id, sql}) && sql
        {:cached, _update, _reset, {_id, sql}} -> sql
      end

    %{num_rows: num, rows: rows} = query!(sql, params)
    {num, rows}
  end

  @impl true
  def stream(_meta, _query_meta, _query, _params, _opts),
    do: raise(ArgumentError, "LlvPglite.Adapter does not support Repo.stream/2")

  ## Schema

  @impl true
  def autogenerate(:id), do: nil
  def autogenerate(:embed_id), do: Ecto.UUID.generate()
  def autogenerate(:binary_id), do: Ecto.UUID.bingenerate()

  @impl true
  def insert(_meta, %{source: source, prefix: prefix}, params, on_conflict, returning, _opts) do
    {kind, conflict_params, _} = on_conflict
    {fields, values} = :lists.unzip(params)
    sql = @conn.insert(prefix, source, fields, [fields], on_conflict, returning, [])
    struct(sql, :insert, source, [], values ++ conflict_params, kind, returning)
  end

  @impl true
  def update(_meta, %{source: source, prefix: prefix}, fields, params, returning, _opts) do
    {fields, field_values} = :lists.unzip(fields)
    sql = @conn.update(prefix, source, fields, params, returning)

    struct(
      sql,
      :update,
      source,
      params,
      field_values ++ Keyword.values(params),
      :raise,
      returning
    )
  end

  @impl true
  def delete(_meta, %{source: source, prefix: prefix}, params, returning, _opts) do
    sql = @conn.delete(prefix, source, params, returning)
    struct(sql, :delete, source, params, Keyword.values(params), :raise, returning)
  end

  @impl true
  def insert_all(
        _meta,
        %{source: source, prefix: prefix},
        header,
        rows,
        on_conflict,
        returning,
        placeholders,
        opts
      ) do
    {_, conflict_params, _} = on_conflict

    {rows, params} =
      case rows do
        {%Ecto.Query{} = query, params} -> {query, Enum.reverse(params)}
        rows -> unzip_inserts(header, rows)
      end

    sql = @conn.insert(prefix, source, header, rows, on_conflict, returning, placeholders, opts)

    %{num_rows: num, rows: rows} =
      query!(sql, placeholders ++ Enum.reverse(params, conflict_params))

    {num, rows}
  end

  # Mirrors Ecto.Adapters.SQL.struct/10, minus DBConnection.
  defp struct(sql, operation, source, params, values, on_conflict, returning) do
    case query(sql, values) do
      {:ok, %{rows: nil, num_rows: 1}} ->
        {:ok, []}

      {:ok, %{rows: [values], num_rows: 1}} ->
        {:ok, Enum.zip(returning, values)}

      {:ok, %{num_rows: 0}} ->
        if on_conflict == :nothing, do: {:ok, []}, else: {:error, :stale}

      {:ok, %{num_rows: n}} ->
        raise Ecto.MultiplePrimaryKeyError,
          source: source,
          params: params,
          count: n,
          operation: operation

      {:error, err} ->
        # Postgrex.Error arrives with its SQLSTATE fields, so unique and
        # foreign-key constraints become changeset errors as with the real adapter.
        case @conn.to_constraints(err, source: source) do
          [] -> raise err
          constraints -> {:invalid, constraints}
        end
    end
  end

  defp unzip_inserts(header, rows) do
    Enum.map_reduce(rows, [], fn fields, params ->
      Enum.map_reduce(header, params, fn key, acc ->
        case :lists.keyfind(key, 1, fields) do
          {^key, {%Ecto.Query{} = query, query_params}} ->
            {{query, length(query_params)}, Enum.reverse(query_params, acc)}

          {^key, {:placeholder, index}} ->
            {{:placeholder, Integer.to_string(index)}, acc}

          {^key, value} ->
            {key, [value | acc]}

          false ->
            {nil, acc}
        end
      end)
    end)
  end

  ## Migration
  #
  # DDL comes from the same Postgres generator. One tab, one connection: no
  # lock is needed.

  @impl true
  def supports_ddl_transaction?, do: false

  @impl true
  def execute_ddl(_meta, command, _opts) do
    for sql <- @conn.execute_ddl(command), do: query!(sql, [])
    {:ok, []}
  end

  @impl true
  def lock_for_migrations(_meta, _opts, fun), do: fun.()

  ## Transport

  # Insert/update/delete SQL comes back from the generator as iodata.
  defp query(sql, params), do: PGlite.query(IO.iodata_to_binary(sql), params)

  defp query!(sql, params) do
    case query(sql, params) do
      {:ok, result} -> result
      {:error, err} -> raise err
    end
  end

  defp id, do: System.unique_integer([:positive])
end
