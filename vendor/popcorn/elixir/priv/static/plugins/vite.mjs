import { mkdir, cp, rm, readFile } from 'node:fs/promises';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { r as runtimeDirectory, p as popcorn$1 } from './shared.mjs';
import 'node:child_process';
import 'node:os';
import 'node:util';

/** Headers required by the threaded WebAssembly runtime. */
const crossOriginIsolationHeaders = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
};
// Plugin is at dist/plugins/vite.mjs, dist/ is one level up.
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
function popcorn(options) {
    const resolveRuntime = async (source, importer) => {
        if (importer !== undefined &&
            resolve(dirname(importer.split("?")[0]), source) ===
                join(distDir, "beam.emu.mjs")) {
            const { runtimeVariant } = await ensurePrepared();
            const runtimeDir = runtimeDirectory(runtimeVariant);
            return join(runtimeDir, "beam.emu.mjs");
        }
    };
    let prepared;
    let repacking;
    let dirty = false;
    let outDir;
    let assetsDir = "assets";
    let workerDerivedOtpRoot = `/@fs${distDir}/otp/`;
    // Dev/preview: pack once at server startup, then re-pack lazily after the
    // app's compiled beams change. A single in-flight promise dedupes concurrent
    // requests; a change during a re-pack re-sets `dirty` so it isn't lost.
    const ensurePrepared = () => {
        if (prepared !== undefined && !dirty)
            return Promise.resolve(prepared);
        if (repacking === undefined) {
            dirty = false;
            repacking = popcorn$1(options)
                .then(async (next) => {
                if (prepared !== undefined) {
                    await rm(prepared.dir, { recursive: true, force: true });
                }
                prepared = next;
                return next;
            })
                .finally(() => {
                repacking = undefined;
            });
        }
        return repacking;
    };
    const cleanup = () => {
        if (prepared !== undefined) {
            rm(prepared.dir, { recursive: true, force: true });
            prepared = undefined;
        }
    };
    const serve = async (req, res, next) => {
        const url = req.url;
        if (url === undefined) {
            next();
            return;
        }
        const requestPath = decodeURIComponent(new URL(url, "http://localhost").pathname);
        const requestRoot = [`/${assetsDir}/otp/`, workerDerivedOtpRoot].find((root) => requestPath.startsWith(root));
        if (requestRoot === undefined) {
            next();
            return;
        }
        let dir;
        try {
            ({ dir } = await ensurePrepared());
        }
        catch (error) {
            next(error);
            return;
        }
        const assetsRoot = join(dir, "otp");
        const filePath = resolve(assetsRoot, requestPath.slice(requestRoot.length));
        if (!isUnder(assetsRoot, filePath)) {
            res.statusCode = 403;
            res.end("Forbidden");
            return;
        }
        try {
            const compressible = isCompressible(filePath);
            const encoding = compressible
                ? selectEncoding(req.headers["accept-encoding"]?.toString())
                : { name: null, suffix: "" };
            if (compressible && encoding.name === null) {
                res.statusCode = 406;
                res.setHeader("Vary", "Accept-Encoding");
                res.end("No supported content encoding");
                return;
            }
            const content = await readFile(`${filePath}${encoding.suffix}`);
            setContentType(res, filePath);
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Vary", "Accept-Encoding");
            if (encoding.name !== null) {
                res.setHeader("Content-Encoding", encoding.name);
            }
            res.end(content);
        }
        catch {
            res.statusCode = 404;
            res.end("Not found");
        }
    };
    return {
        name: "popcorn-otp",
        enforce: "pre",
        resolveId: resolveRuntime,
        config() {
            return {
                // Exclude from prebundling so import.meta.url resolves correctly.
                optimizeDeps: { exclude: ["@swmansion/popcorn"] },
                worker: {
                    format: "es",
                    plugins: () => [
                        {
                            name: "popcorn-runtime",
                            enforce: "pre",
                            resolveId: resolveRuntime,
                        },
                    ],
                },
            };
        },
        configResolved(config) {
            config.server.fs.allow.push(distDir);
            outDir = resolve(config.root, config.build.outDir);
            assetsDir = config.build.assetsDir;
            const servedDistDir = isUnder(config.root, distDir)
                ? `/${relative(config.root, distDir)}`
                : `/@fs${distDir}`;
            workerDerivedOtpRoot = `${servedDistDir}/otp/`;
        },
        async configureServer(server) {
            const rootDir = resolve(options.rootDir);
            server.httpServer?.prependListener("request", setIsolationHeaders);
            server.watcher.add(rootDir);
            server.watcher.on("all", (_event, file) => {
                if (isUnder(rootDir, file))
                    dirty = true;
            });
            server.middlewares.use(serve);
            server.httpServer?.once("close", cleanup);
            await ensurePrepared();
            dirty = false;
        },
        async configurePreviewServer(server) {
            server.httpServer?.prependListener("request", setIsolationHeaders);
            server.middlewares.use(serve);
            server.httpServer?.once("close", cleanup);
            await ensurePrepared();
        },
        async closeBundle() {
            assert(outDir !== undefined, "outDir was not resolved");
            const built = await ensurePrepared();
            try {
                const targetDir = join(outDir, assetsDir, "otp");
                await mkdir(dirname(targetDir), { recursive: true });
                await cp(join(built.dir, "otp"), targetDir, { recursive: true });
            }
            finally {
                await rm(built.dir, { recursive: true, force: true });
                prepared = undefined;
            }
        },
    };
}
function isCompressible(path) {
    return path.endsWith(".tar") || path.endsWith(".wasm");
}
function selectEncoding(header) {
    if (header?.includes("br")) {
        return { name: "br", suffix: ".br" };
    }
    if (header?.includes("gzip"))
        return { name: "gzip", suffix: ".gz" };
    return { name: null, suffix: "" };
}
function isUnder(dir, file) {
    const rel = relative(dir, file);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}
function setIsolationHeaders(_req, res) {
    for (const [key, value] of Object.entries(crossOriginIsolationHeaders)) {
        res.setHeader(key, value);
    }
}
function setContentType(res, path) {
    if (path.endsWith(".mjs")) {
        res.setHeader("Content-Type", "text/javascript");
    }
    else if (path.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
    }
    else if (path.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json");
    }
    else {
        res.setHeader("Content-Type", "application/octet-stream");
    }
}
function assert(ok, message) {
    if (!ok) {
        throw new Error(`[popcorn-otp] ${message}`);
    }
}

export { crossOriginIsolationHeaders, popcorn };
