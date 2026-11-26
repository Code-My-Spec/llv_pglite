import type { Plugin } from "esbuild";
import { type Options } from "./shared";
/**
 * Copies the worker, VM runtime, and `otp/` assets into the output directory after a successful esbuild build.
 *
 * Requires `format: "esm"` and either `outdir` or `outfile`.
 * If the application bundle is elsewhere, set `PopcornOpts.workerUrl` to the copied `worker.mjs`.
 *
 * @see {@link Options} for application packaging and server requirements.
 */
export declare function popcorn(options: Options): Plugin;
