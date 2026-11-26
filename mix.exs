defmodule LlvPglite.MixProject do
  use Mix.Project

  def project do
    [
      app: :llv_pglite,
      version: "0.1.0",
      elixir: "~> 1.19",
      deps: deps(),
      description:
        "Ecto on PGlite for LocalLiveView: the host app's schemas and migrations, in the browser"
    ]
  end

  def application, do: [extra_applications: [:logger, :crypto]]

  defp deps do
    [
      # Patched copies, see each VENDORED.md. LocalLiveView picks up
      # vendor/popcorn/elixir as a path dep by itself.
      {:local_live_view, path: "vendor/local_live_view"},
      {:ecto_sql, "~> 3.13"},
      # Only for Postgrex.Error and Ecto's Postgres SQL generator; never connects,
      # so never started.
      {:postgrex, ">= 0.0.0", runtime: false}
    ]
  end
end
