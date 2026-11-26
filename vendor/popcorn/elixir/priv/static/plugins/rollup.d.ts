import type { Plugin } from "rollup";
import { type Options } from "./shared";
/**
 * Copies the worker, VM runtime, and `otp/` assets into the output directory after Rollup writes the bundle.
 *
 * Requires `output.format: "es"` and either `output.dir` or `output.file`.
 * If the application bundle is elsewhere, set `PopcornOpts.workerUrl` to the copied `worker.mjs`.
 *
 * @see {@link Options} for application packaging and server requirements.
 */
export declare function popcorn(options: Options): Plugin;
