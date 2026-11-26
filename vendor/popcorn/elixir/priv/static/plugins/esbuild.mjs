import { mkdir, cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { p as popcorn$1 } from './shared.mjs';
import 'node:child_process';
import 'node:os';
import 'node:util';
import 'node:url';

/**
 * Copies the worker, VM runtime, and `otp/` assets into the output directory after a successful esbuild build.
 *
 * Requires `format: "esm"` and either `outdir` or `outfile`.
 * If the application bundle is elsewhere, set `PopcornOpts.workerUrl` to the copied `worker.mjs`.
 *
 * @see {@link Options} for application packaging and server requirements.
 */
function popcorn(options) {
    let outputDir;
    return {
        name: "popcorn-otp",
        setup(build) {
            build.onStart(() => {
                const opts = build.initialOptions;
                const outdir = opts.outdir ??
                    (opts.outfile === undefined ? undefined : dirname(opts.outfile));
                assert(opts.format === "esm", "Popcorn OTP works only with esm builds.");
                assert(outdir !== undefined, "outdir is not specified, cannot copy files");
                outputDir = resolve(outdir);
            });
            build.onEnd(async (result) => {
                if (result.errors.length > 0)
                    return;
                assert(outputDir !== undefined, "outdir was not resolved");
                const outDir = outputDir;
                const prepared = await popcorn$1(options);
                try {
                    await mkdir(outDir, { recursive: true });
                    await cp(prepared.dir, outDir, { recursive: true });
                }
                finally {
                    await rm(prepared.dir, { recursive: true, force: true });
                }
            });
        },
    };
}
function assert(ok, message) {
    if (!ok) {
        throw new Error(`[popcorn-otp] ${message}`);
    }
}

export { popcorn };
