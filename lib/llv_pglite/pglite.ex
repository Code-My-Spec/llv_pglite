defmodule LlvPglite.PGlite do
  @moduledoc """
  Transport from Ecto (in Popcorn) to PGlite, Postgres 19 compiled to Wasm,
  running in a Web Worker in the same tab (`priv/static/pglite/pg_worker.mjs` in this package).

  The worker returns values as Postgres text plus each column's type OID, and
  this module decodes them into the same terms Postgrex would produce, so
  Ecto's normal Postgres loaders work unchanged. Errors come back as
  `%Postgrex.Error{}` with the SQLSTATE fields, so constraint violations
  become changeset errors.
  """
  @compile {:no_warn_undefined, Popcorn.JS}

  # The first query waits for PGlite to boot (download + initdb on first visit).
  @timeout 60_000

  @js "({sql, params}) => window.BrowserPG.query(sql, params)"

  @doc "Runs one statement. Same shape as Postgrex: `{:ok, %{rows, num_rows}} | {:error, %Postgrex.Error{}}`."
  def query(sql, params) do
    case Popcorn.JS.run(@js, %{sql: sql, params: Enum.map(params, &encode/1)}, timeout: @timeout) do
      {:ok, %{"columns" => cols, "types" => types, "rows" => rows, "affectedRows" => affected}} ->
        rows = Enum.map(rows, fn row -> row |> Enum.zip(types) |> Enum.map(&decode/1) end)

        # Postgrex reports rows: nil for statements without a result set.
        {rows, num} = if cols == [], do: {nil, affected}, else: {rows, length(rows)}
        {:ok, %{columns: cols, rows: rows, num_rows: num}}

      {:error, {:js, reason}} ->
        {:error, to_error(reason)}

      {:error, :timeout} ->
        {:error, %Postgrex.Error{message: "PGlite worker timed out after #{@timeout}ms"}}
    end
  end

  @doc "PGlite's version, storage and boot time."
  def info, do: Popcorn.JS.run!("() => window.BrowserPG.info()", %{}, timeout: @timeout)

  @doc "Deletes the whole database (its IndexedDB storage) and boots an empty one."
  def reset!, do: Popcorn.JS.run!("() => window.BrowserPG.reset()", %{}, timeout: @timeout)

  ## Errors

  @error_fields %{
    "code" => :code,
    "constraint" => :constraint,
    "table" => :table,
    "column" => :column,
    "schema" => :schema,
    "detail" => :detail,
    "hint" => :hint,
    "severity" => :severity
  }

  defp to_error(reason) do
    # The JS Error arrives as "Error: {json}".
    json = reason |> to_string() |> String.replace_prefix("Error: ", "")

    case JSON.decode(json) do
      {:ok, %{"message" => msg} = e} ->
        pg =
          for {k, key} <- @error_fields, e[k] != nil, into: %{message: msg}, do: {key, e[k]}

        pg =
          if code = pg[:code],
            do: Map.merge(pg, %{pg_code: code, code: code_name(code)}),
            else: pg

        %Postgrex.Error{postgres: pg}

      _ ->
        %Postgrex.Error{message: to_string(reason)}
    end
  end

  # Ecto.Adapters.Postgres.Connection.to_constraints/2 matches on these names.
  defp code_name("23505"), do: :unique_violation
  defp code_name("23503"), do: :foreign_key_violation
  defp code_name("23514"), do: :check_violation
  defp code_name("23P01"), do: :exclusion_violation
  defp code_name("23502"), do: :not_null_violation
  defp code_name(code), do: code

  ## Params: Elixir terms -> values PGlite sends as text

  defp encode(%DateTime{} = v), do: DateTime.to_iso8601(v)
  defp encode(%NaiveDateTime{} = v), do: NaiveDateTime.to_iso8601(v)
  defp encode(%Date{} = v), do: Date.to_iso8601(v)
  defp encode(%Time{} = v), do: Time.to_iso8601(v)
  defp encode(%Decimal{} = v), do: Decimal.to_string(v)
  defp encode(v) when is_list(v), do: Enum.map(v, &encode/1)
  defp encode(v) when is_map(v), do: JSON.encode!(v)
  defp encode(v) when is_integer(v) and abs(v) > 9_007_199_254_740_991, do: Integer.to_string(v)

  defp encode(v) when is_binary(v) do
    cond do
      String.valid?(v) -> v
      # Ecto dumps :binary_id to 16 raw bytes; Postgres wants the text form.
      byte_size(v) == 16 -> Ecto.UUID.load!(v)
      true -> "\\x" <> Base.encode16(v, case: :lower)
    end
  end

  defp encode(v), do: v

  ## Results: Postgres text + OID -> the terms Postgrex returns

  defp decode({nil, _}), do: nil
  defp decode({v, 16}), do: v == "t"
  defp decode({v, oid}) when oid in [20, 21, 23, 26], do: String.to_integer(v)
  defp decode({v, oid}) when oid in [700, 701], do: float(v)
  defp decode({v, 1700}), do: Decimal.new(v)
  defp decode({v, 1082}), do: Date.from_iso8601!(v)
  defp decode({v, 1083}), do: Time.from_iso8601!(v)
  defp decode({v, 1114}), do: NaiveDateTime.from_iso8601!(v)
  defp decode({v, 1184}), do: v |> utc_offset() |> DateTime.from_iso8601() |> elem(1)
  defp decode({v, 2950}), do: Ecto.UUID.dump!(v)
  defp decode({v, oid}) when oid in [114, 3802], do: JSON.decode!(v)
  defp decode({"\\x" <> hex, 17}), do: Base.decode16!(hex, case: :mixed)
  defp decode({v, _text}), do: v

  defp float("NaN"), do: :NaN
  defp float("Infinity"), do: :inf
  defp float("-Infinity"), do: :"-inf"
  defp float(v), do: v |> Float.parse() |> elem(0)

  # Postgres prints "+00"; ISO 8601 parsing wants "+00:00".
  defp utc_offset(v), do: if(Regex.match?(~r/[+-]\d\d$/, v), do: v <> ":00", else: v)
end
