type RuntimeVariant = "core" | "crypto";
/**
 * Shared options for the Vite, Rollup, and esbuild plugins.
 *
 * The plugins invoke `mix popcorn.cook` in the project directory, which
 * compiles the project before packaging it.
 */
export type Options = {
    /** Mix project directory. Cooking options belong in its config/config.exs. */
    rootDir: string;
};
export type Prepared = {
    dir: string;
    runtimeVariant: RuntimeVariant;
    notes: unknown[];
};
export declare function popcorn(options: Options): Promise<Prepared>;
export declare function runtimeDirectory(variant: RuntimeVariant): string;
export {};
