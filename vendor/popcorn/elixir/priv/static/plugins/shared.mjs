import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
async function popcorn(options) {
    const dir = await mkdtemp(`${tmpdir()}/popcorn-otp-`);
    const args = ["popcorn.cook", "--out-dir", dir];
    try {
        await execFileAsync("mix", args, {
            cwd: resolve(options.rootDir),
            env: { ...process.env, MIX_QUIET: "1" },
        });
        const manifestPath = resolve(dir, "otp/manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        assert(manifest.runtimeVariant === "core" ||
            manifest.runtimeVariant === "crypto", "popcorn.cook did not report a runtime variant");
        return {
            dir,
            runtimeVariant: manifest.runtimeVariant,
            notes: manifest.notes ?? [],
        };
    }
    catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
    }
}
function runtimeDirectory(variant) {
    const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    return resolve(distDir, "runtimes", variant);
}
function assert(ok, message) {
    if (!ok)
        throw new Error(`[popcorn-otp] ${message}`);
}

export { popcorn as p, runtimeDirectory as r };
