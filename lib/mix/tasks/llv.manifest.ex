defmodule Mix.Tasks.Llv.Manifest do
  @shortdoc "Writes the live_local route manifest for static hosting"
  @moduledoc """
  Reads the router's `live_local` routes and writes them as JSON, so a host
  with no Elixir (the preview server) can serve the static page shell at each
  path with the right view.

      mix llv.manifest [--router MyAppWeb.Router] [--out priv/static/llv_routes.json]

  Output:

      {"routes": [{"path": "/local/hello", "view": "HelloLocal"}, ...]}

  Paths keep Phoenix's `:param` and `*glob` segments; the host matches them.
  Routes to anything other than a `live_local` view are left out: those need
  the real server.
  """
  use Mix.Task

  @requirements ["compile"]

  @impl true
  def run(args) do
    {opts, _} = OptionParser.parse!(args, strict: [router: :string, out: :string])

    router =
      case opts[:router] do
        nil -> default_router()
        name -> Module.concat([name])
      end

    out = opts[:out] || "priv/static/llv_routes.json"
    routes = routes(router)

    File.mkdir_p!(Path.dirname(out))
    File.write!(out, JSON.encode!(%{routes: routes}))
    Mix.shell().info("Wrote #{length(routes)} live_local route(s) to #{out}")
  end

  @doc false
  def routes(router) do
    for %{plug: LocalLiveView.Controller, verb: :get, path: path} = route <- router.__routes__() do
      %{path: path, view: route.metadata.llv_view}
    end
  end

  defp default_router do
    app = Mix.Project.config()[:app] |> to_string() |> Macro.camelize()
    Module.concat([app <> "Web", "Router"])
  end
end
