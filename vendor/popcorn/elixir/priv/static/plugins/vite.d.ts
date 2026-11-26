import type { Plugin } from "vite";
import { type Options } from "./shared";
/** Headers required by the threaded WebAssembly runtime. */
export declare const crossOriginIsolationHeaders: {
    "Cross-Origin-Opener-Policy": string;
    "Cross-Origin-Embedder-Policy": string;
};
/**
 * Serves application assets during developmens.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite";
 * import { popcorn } from "@swmansion/popcorn/vite";
 *
 * export default defineConfig({
 *   plugins: [popcorn({ rootDir: "../my_app" })],
 * });
 * ```
 *
 * @see {@link Options} for production server requirements.
 */
export declare function popcorn(options: Options): Plugin;
