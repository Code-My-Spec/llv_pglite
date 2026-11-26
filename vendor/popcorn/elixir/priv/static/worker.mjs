import createModule from './beam.emu.mjs';

function dirname(path) {
    const idx = path.lastIndexOf("/");
    if (idx <= 0)
        return "/";
    return path.slice(0, idx);
}
async function fetchBinary(url) {
    try {
        const response = await fetch(url);
        if (response.ok !== true)
            return null;
        return new Uint8Array(await response.arrayBuffer());
    }
    catch {
        return null;
    }
}
async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (response.ok !== true)
            return null;
        return await response.json();
    }
    catch {
        return null;
    }
}
function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
function check(ok, msg) {
    if (!ok)
        throw new Error(msg ?? "Check failed");
}
function unreachable(_value) {
    throw new Error("Entered unreachable code");
}
function objectWithKeys$1(value, keys) {
    if (value === null || typeof value !== "object")
        return null;
    if (Object.getPrototypeOf(value) !== Object.prototype)
        return null;
    const hasAllKeys = keys.every((k) => Object.hasOwn(value, k));
    if (!hasAllKeys)
        return null;
    return value;
}

function err(t, data) {
    return new PopcornError({ t, data });
}
function isErr(error, t) {
    const isInstance = error instanceof PopcornError;
    if (!isInstance)
        return false;
    return true;
}
/** @hidden */
class PopcornError extends Error {
    cause;
    serialized;
    constructor(cause) {
        super(message(cause), { cause });
        this.name = "PopcornError";
        Object.setPrototypeOf(this, new.target.prototype);
        this.cause = cause;
        this.serialized = cause;
    }
    get t() {
        return this.serialized.t;
    }
    get data() {
        return this.serialized.data;
    }
    /** Returns the tag and a shallow copy of its details. */
    serialize() {
        return {
            t: this.serialized.t,
            data: { ...this.serialized.data },
        };
    }
    /** Restores a serialized error. Throws if validation fails. */
    static deserialize(value) {
        return new PopcornError(parse(value));
    }
}
function message(error) {
    switch (error.t) {
        case "timeout":
            return `${error.data.operation} timed out after ${error.data.timeoutMs}ms`;
        case "worker:load":
            return error.data.message;
        case "vm:exited":
            return "VM exited";
        case "bridge:not-started":
            return "Bridge did not start";
        case "bridge:invalid-target":
            return "Target must be a non-empty name or a PID from this VM boot";
        case "bridge:unserializable":
            return "Message can't be serialized to ETF";
        case "bridge:listener-not-found":
            return `Target listener not found: '${error.data.targetName}'`;
        case "genserver:noproc":
            return `No process registered for genserver target: '${error.data.target}'`;
        case "genserver:exit":
            return `Genserver exited: ${error.data.reason}`;
        case "genserver:unserializable":
            return "Genserver reply can't be serialized to JSON";
        case "stdio:overflow":
            return `Stdin chunk exceeds the ${error.data.capacityBytes} byte queue capacity`;
        case "asset:load":
            return error.data.kind === "manifest-entry"
                ? `Missing manifest entry: '${error.data.name}' in '${error.data.url}'. Available entries: ${error.data.available.join(", ")}`
                : `Failed to load ${error.data.kind}: '${error.data.url}'`;
        case "runtime:eval-unavailable":
            return "JS eval is unavailable; run_js requires a Content-Security-Policy that allows 'unsafe-eval'";
        default:
            unreachable();
    }
}
function parse(value) {
    check(objectWithKeys(value, ["t", "data"]));
    const tag = value.t;
    switch (tag) {
        case "timeout":
            check(isTimeoutData(value.data));
            return { t: tag, data: value.data };
        case "worker:load":
            check(isWorkerLoadData(value.data));
            return { t: tag, data: value.data };
        case "vm:exited":
            check(isVmExitedData(value.data));
            return { t: tag, data: value.data };
        case "bridge:not-started":
            check(isEmptyData(value.data));
            return { t: tag, data: value.data };
        case "bridge:invalid-target":
            check(isEmptyData(value.data));
            return { t: tag, data: value.data };
        case "bridge:unserializable":
            check(isUnserializableData(value.data));
            return { t: tag, data: value.data };
        case "bridge:listener-not-found":
            check(isListenerNotFoundData(value.data));
            return { t: tag, data: value.data };
        case "genserver:noproc":
            check(objectWithKeys(value.data, ["target"]) &&
                typeof value.data.target === "string");
            return { t: tag, data: { target: value.data.target } };
        case "genserver:exit":
            check(objectWithKeys(value.data, ["reason"]) &&
                typeof value.data.reason === "string");
            return { t: tag, data: { reason: value.data.reason } };
        case "genserver:unserializable":
            check(isEmptyData(value.data));
            return { t: tag, data: value.data };
        case "stdio:overflow":
            check(isStdioOverflowData(value.data));
            return { t: tag, data: value.data };
        case "asset:load":
            check(isAssetLoadData(value.data));
            return { t: tag, data: value.data };
        case "runtime:eval-unavailable":
            check(isEmptyData(value.data));
            return { t: tag, data: value.data };
        default:
            unreachable();
    }
}
function isTimeoutData(value) {
    return (objectWithKeys(value, ["operation", "timeoutMs"]) &&
        (value.operation === "init" ||
            value.operation === "send" ||
            value.operation === "call") &&
        typeof value.timeoutMs === "number");
}
function isWorkerLoadData(value) {
    return objectWithKeys(value, ["message"]);
}
function isVmExitedData(value) {
    return objectWithKeys(value, ["reason"]);
}
function isListenerNotFoundData(value) {
    return objectWithKeys(value, ["targetName"]);
}
function isStdioOverflowData(value) {
    return objectWithKeys(value, ["capacityBytes", "attemptedBytes"]);
}
function isUnserializableData(value) {
    return (objectWithKeys(value, ["data", "part", "reason"]) &&
        isUnserializableReason(value.reason));
}
function isUnserializableReason(value) {
    return (value === "cyclic-object" ||
        value === "non-plain-object" ||
        value === "lossy-int" ||
        value === "non-finite-float" ||
        value === "unsupported");
}
function isAssetLoadData(value) {
    if (!objectWithKeys(value, ["kind", "url"]) || typeof value.url !== "string") {
        return false;
    }
    switch (value.kind) {
        case "manifest":
        case "tarball":
            return true;
        case "manifest-entry":
            return (objectWithKeys(value, ["name", "available"]) &&
                typeof value.name === "string" &&
                Array.isArray(value.available) &&
                value.available.every((name) => typeof name === "string"));
        default:
            return false;
    }
}
function isEmptyData(value) {
    return objectWithKeys(value, []);
}
function objectWithKeys(value, keys) {
    const isObject = value !== null && typeof value === "object";
    return isObject && keys.every((key) => Object.hasOwn(value, key));
}

new TextEncoder();

function readMainEvent(value) {
    const data = objectWithKeys$1(value, ["type", "payload"]);
    check(data !== null && typeof data.type === "string");
    switch (data.type) {
        case "popcorn:boot":
        case "popcorn:stdin":
        case "popcorn:tty-resize":
        case "popcorn:send":
        case "popcorn:bridge-reply":
            return data;
        default:
            unreachable();
    }
}
function deserializeBridgeMessage(text) {
    try {
        const parsed = JSON.parse(text);
        if (!isBridgeEnvelope(parsed))
            return null;
        switch (parsed.type) {
            case "vm_message":
                return { type: "otp:message", payload: parsed.data };
            case "vm_error":
                return {
                    type: "otp:error",
                    payload: { kind: "error", data: parsed.data },
                };
            case "run_js":
                return {
                    type: "otp:run_js",
                    payload: {
                        code: parsed.code,
                        args: parsed.args,
                        replyTo: base64ToBytes(parsed.reply_to),
                        return: parsed.return,
                    },
                };
            case "await_ready":
                return {
                    type: "otp:await-ready",
                    payload: { replyTo: base64ToBytes(parsed.reply_to) },
                };
            default:
                return null;
        }
    }
    catch {
        return null;
    }
}
/** Usable only from webworkers. */
function toMain(event) {
    self.postMessage(event, { transfer: getTransferables(event) });
}
function getTransferables(event) {
    const isTtyEvent = event.type === "otp:stdout" || event.type === "otp:stderr";
    if (!isTtyEvent)
        return [];
    check(event.payload.buffer instanceof ArrayBuffer);
    return [event.payload.buffer];
}
function isBridgeEnvelope(value) {
    const KNOWN_MESSAGE_TYPES = [
        "vm_message",
        "vm_error",
        "run_js",
        "await_ready",
    ];
    const data = objectWithKeys$1(value, ["type"]);
    return data !== null && KNOWN_MESSAGE_TYPES.includes(data.type);
}

// Tar format constants.
const T = {
    /// entire block size (bytes)
    BLK_N: 512,
    /// filename field offset
    NAME_OFF: 0,
    /// name field size (bytes)
    NAME_N: 100,
    /// file size field offset
    SIZE_OFF: 124,
    /// file size field size (bytes). Stored as ASCII octal string.
    SIZE_N: 12,
    /// entry type field offset, 1 byte.
    TYPEFLAG_OFF: 156,
    /// prefix field offset, 1 byte. Used when name is longer than `name` field.
    PREFIX_OFF: 345,
    /// prefix field size (bytes)
    PREFIX_N: 155,
    /// entry type=dir, '5' in ASCII
    TYPE_DIR: 53,
    /// entry type=PAX extended header, 'x' in ASCII
    TYPE_PAX: 120,
};
function extractTar(data, onDir, onFile) {
    check(data.length % T.BLK_N === 0, "tar:bad_chunk");
    const decoder = new TextDecoder();
    let offset = 0;
    let paxPath = null;
    while (offset + T.BLK_N <= data.length) {
        const header = data.slice(offset, offset + T.BLK_N);
        if (isZeroBlock(header)) {
            check(paxPath === null, "tar:dangling_pax");
            break;
        }
        const name = readString(decoder, header, T.NAME_OFF, T.NAME_N);
        const prefix = readString(decoder, header, T.PREFIX_OFF, T.PREFIX_N);
        const headerName = prefix ? `${prefix}/${name}` : name;
        const size = parseOctal(readString(decoder, header, T.SIZE_OFF, T.SIZE_N));
        const type = header[T.TYPEFLAG_OFF];
        offset += T.BLK_N;
        check(offset + size <= data.length, "tar:truncated_entry");
        const contents = data.slice(offset, offset + size);
        if (type === T.TYPE_PAX) {
            check(paxPath === null, "tar:unexpected_pax");
            paxPath = readPaxPath(decoder, contents);
        }
        else {
            const fullName = paxPath ?? headerName;
            paxPath = null;
            const path = fullName.startsWith("/") ? fullName : `/${fullName}`;
            if (type === T.TYPE_DIR) {
                onDir(path);
            }
            else if (fullName) {
                onFile(path, contents);
            }
        }
        offset += Math.ceil(size / T.BLK_N) * T.BLK_N;
    }
    check(paxPath === null, "tar:dangling_pax");
}
function readPaxPath(decoder, data) {
    let offset = 0;
    let path = null;
    while (offset < data.length) {
        const { length, recordStart } = readPaxLength(decoder, data, offset);
        const recordEnd = offset + length;
        offset = recordEnd;
        const [key, value] = readPaxRecord(decoder, data, recordStart, recordEnd);
        if (key === "path") {
            check(value.length > 0, "tar:bad_pax_path");
            path = value;
        }
    }
    check(path !== null, "tar:missing_pax_path");
    return path;
}
function readPaxLength(decoder, data, offset) {
    const SPACE = 32;
    const separator = data.indexOf(SPACE, offset);
    check(separator > offset, "tar:bad_pax_length");
    const source = decoder.decode(data.subarray(offset, separator));
    const length = Number(source);
    const isInt = Number.isSafeInteger(length) && length >= 0 && String(length) === source;
    check(isInt, "tar:bad_pax_length");
    return { length, recordStart: separator + 1 };
}
function readPaxRecord(decoder, data, start, end) {
    const record = decoder.decode(data.subarray(start, end));
    check(record.endsWith("\n"), "tar:bad_pax_record");
    const separator = record.indexOf("=");
    check(separator > 0, "tar:bad_pax_record");
    const key = record.slice(0, separator);
    // drop '\n'
    const value = record.slice(separator + 1, -1);
    return [key, value];
}
function isZeroBlock(block) {
    for (let i = 0; i < block.length; i++) {
        if (block[i] !== 0)
            return false;
    }
    return true;
}
function readString(decoder, data, start, length) {
    check(length > 0, "tar:bad_string");
    let end = start;
    const max = start + length;
    while (end < max && data[end] !== 0)
        end++;
    if (end === start)
        return "";
    return decoder.decode(data.slice(start, end));
}
function parseOctal(value) {
    const parsed = parseInt(value, 8);
    check(!Number.isNaN(parsed), "tar:bad_octal");
    return parsed;
}

const DEFAULT_USER = "web_user";
const DEFAULT_HOME_DIR = "/home/web_user";
const FS_DIRS = ["/bin", "/lib", "/etc", "/tmp", "/home", DEFAULT_HOME_DIR];
const BOOT_NAME = "vm";
const MANIFEST_NAME = "manifest.json";
const BOOT_MODULE = "Elixir.Popcorn.Boot";
const STDOUT_FD = 1;
const MAX_STACK_ETF_BYTES = 32 * 1024;
const UTF8 = new TextEncoder();
const BASE_ARGS = [
    "-root",
    "/",
    "-bindir",
    "/bin",
    "-progname",
    "erl",
    "-home",
    DEFAULT_HOME_DIR,
];
const CORE_APPS = new Set(["kernel", "stdlib", "compiler"]);
function start(options) {
    const state = { module: null, isVmReady: false };
    const vm = trackVmReady(state);
    return {
        boot: boot(options, state, vm),
        vmReady: vm.vmReady,
        send: (message) => send(state.isVmReady ? state.module : null, message),
        writeStdin: (chunk) => writeStdin(state.module, chunk),
        resizeTty: (columns, rows) => resizeTty(state.module, columns, rows),
    };
}
async function boot(opts, state, vm) {
    const { otpAssetsRoot, emulatorArgs, extraArgs, env, ttySize, noshell, createModule, emit, } = opts;
    try {
        const loadedFsData = await loadFsData(otpAssetsRoot);
        if (!loadedFsData.ok) {
            return { ok: false, error: loadedFsData.error };
        }
        const fsData = loadedFsData.data;
        const { vmReady, handleVmReady } = vm;
        const { bootReady, handleBootReady } = trackBootReady();
        const runtimeEnv = {
            ...env,
            BINDIR: "/bin",
            EMU: "beam",
            HOME: DEFAULT_HOME_DIR,
            USER: DEFAULT_USER,
            LOGNAME: DEFAULT_USER,
            COLUMNS: String(ttySize.columns),
            LINES: String(ttySize.rows),
        };
        let emitError = function (payload) {
            emitError = null;
            state.isVmReady = false;
            emit({ type: "otp:error", payload });
        };
        const moduleConfig = {
            print: (text) => emit({ type: "otp:stdout", payload: UTF8.encode(text) }),
            printErr: (text) => emit({ type: "otp:stderr", payload: UTF8.encode(text) }),
            onExit: (code) => emitError?.({ kind: "exit", data: code }),
            onAbort: (text) => emitError?.({ kind: "abort", data: text }),
            onBeamMessage: (text) => {
                if (emitError === null) {
                    return;
                }
                const event = deserializeBridgeMessage(text);
                if (event === null)
                    return;
                if (event.type === "otp:error") {
                    emitError(event.payload);
                    return;
                }
                if (handleVmReady(event))
                    return;
                if (handleBootReady(event))
                    return;
                emit(event);
            },
            onError: (text) => emitError?.({ kind: "error", data: text }),
            onStdinConsumed: (size) => emit({ type: "otp:stdin-consumed", payload: size }),
            onTrackedValueDelete: (key) => emit({ type: "otp:tracked-value-delete", payload: key }),
            onTtyChunk: (fd, chunk) => emit({
                type: fd === STDOUT_FD ? "otp:stdout" : "otp:stderr",
                payload: chunk,
            }),
            arguments: buildArgs({
                appNames: fsData.appNames,
                entrypoint: fsData.entrypoint,
                noshell,
                emulator: emulatorArgs ?? [],
                extra: extraArgs ?? [],
            }),
            preRun: [
                (mod) => {
                    state.module = mod;
                },
                (mod) => {
                    Object.assign(mod.ENV, runtimeEnv);
                    initFs({ module: mod, fsData });
                },
            ],
        };
        if (opts.maxMemoryBytes !== undefined) {
            moduleConfig.wasmMemory = new WebAssembly.Memory({
                initial: 1024,
                maximum: opts.maxMemoryBytes / 65536,
                shared: true,
            });
        }
        const ready = Promise.all([vmReady, bootReady]);
        const module = await createModule(moduleConfig);
        check(state.module === module);
        await ready;
        return { ok: true, data: null };
    }
    catch (error) {
        return { ok: false, error: toPopcornError(error) };
    }
}
function trackVmReady(state) {
    let resolve = () => { };
    const vmReady = new Promise((r) => {
        resolve = r;
    });
    const handleVmReady = (event) => {
        if (!isBridgeMarker(event, "vm_ready"))
            return false;
        state.isVmReady = true;
        resolve();
        return true;
    };
    return { vmReady, handleVmReady };
}
function trackBootReady() {
    let resolve = () => { };
    let reject = (_error) => { };
    const bootReady = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    const handleBootReady = (event) => {
        if (isBridgeMarker(event, "boot_ready")) {
            resolve();
            return true;
        }
        if (isBridgeMarker(event, "boot_failed")) {
            reject(err("vm:exited", { reason: "exit", data: 1 }));
            return true;
        }
        return false;
    };
    return { bootReady, handleBootReady };
}
function toPopcornError(error) {
    if (isErr(error))
        return error;
    const message = error instanceof Error ? error.message : String(error);
    return err("worker:load", { message });
}
function buildArgs({ appNames, entrypoint, noshell, emulator, extra, }) {
    const args = [...emulator, "--", ...BASE_ARGS, "-boot", BOOT_NAME];
    if (noshell)
        args.push("-noshell");
    for (const app of CORE_APPS) {
        args.push("-pa", `/lib/${app}/ebin`);
    }
    for (const app of appNames) {
        if (CORE_APPS.has(app))
            continue;
        args.push("-pa", `/lib/${app}/ebin`);
    }
    args.push("-run", BOOT_MODULE, "start");
    if (entrypoint !== null)
        args.push(entrypoint);
    for (const arg of extra) {
        args.push(arg);
    }
    return args;
}
function isBridgeMarker(event, type) {
    if (event === null || event.type !== "otp:message")
        return false;
    const popcorn = objectWithKeys$1(event.payload, ["_popcorn"])?._popcorn;
    return objectWithKeys$1(popcorn, ["t"])?.t === type;
}
async function loadFsData(assetsRoot) {
    const manifestUrl = resolveAssetsPath(assetsRoot, MANIFEST_NAME);
    const manifest = await fetchJson(manifestUrl);
    if (manifest === null) {
        return {
            ok: false,
            error: err("asset:load", { kind: "manifest", url: manifestUrl }),
        };
    }
    const appNames = Object.keys(manifest.apps);
    for (const name of CORE_APPS) {
        if (!Object.hasOwn(manifest.apps, name)) {
            return {
                ok: false,
                error: err("asset:load", {
                    kind: "manifest-entry",
                    url: manifestUrl,
                    name,
                    available: appNames,
                }),
            };
        }
    }
    const loadedTarballs = await Promise.all(Object.values(manifest.bundles).map(async (entry) => {
        const tarUrl = resolveAssetsPath(assetsRoot, entry.tar);
        const tar = await fetchBinary(tarUrl);
        if (tar !== null) {
            return { ok: true, data: tar };
        }
        return {
            ok: false,
            error: err("asset:load", { kind: "tarball", url: tarUrl }),
        };
    }));
    const tarballs = [];
    for (const tarball of loadedTarballs) {
        if (!tarball.ok) {
            return { ok: false, error: tarball.error };
        }
        tarballs.push(tarball.data);
    }
    return {
        ok: true,
        data: {
            appNames,
            entrypoint: manifest.entrypoint ?? null,
            tarballs,
        },
    };
}
function initFs({ module, fsData }) {
    const writeFile = (path, content) => {
        module.FS_createDataFile(path, null, content, true, true, true);
    };
    for (const dir of FS_DIRS) {
        module.FS_mkdirTree(dir);
    }
    const createDir = (dirPath) => {
        module.FS_mkdirTree(dirPath);
    };
    const createFile = (path, content) => {
        module.FS_mkdirTree(dirname(path));
        writeFile(path, content);
    };
    for (const tarball of fsData.tarballs) {
        extractTar(tarball, createDir, createFile);
    }
}
function resolveAssetsPath(assetsRoot, relativePath) {
    check(assetsRoot.endsWith("/"));
    if (relativePath.startsWith("/") || isAbsoluteUrl(relativePath)) {
        return relativePath;
    }
    const url = new URL(relativePath, new URL(assetsRoot, self.location.href));
    if (assetsRoot.startsWith("/")) {
        return url.pathname;
    }
    return url.toString();
}
function isAbsoluteUrl(path) {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path);
}
function send(module, message) {
    if (module === null) {
        return { ok: false, error: err("bridge:not-started", {}) };
    }
    let target;
    if (isNameTarget(message.target)) {
        const targetName = message.target.name;
        target = {
            kind: TARGET_REGISTERED_NAME,
            argType: "string",
            value: targetName,
            length: utf8Length(targetName),
        };
    }
    else {
        const bytes = message.target.pid;
        target = {
            kind: TARGET_PID_BYTES,
            argType: "array",
            value: bytes,
            length: bytes.length,
        };
    }
    // ccall copies array arguments onto the limited Wasm stack.
    const useHeap = message.etf.byteLength > MAX_STACK_ETF_BYTES;
    let etfPtr = 0;
    if (useHeap) {
        etfPtr = module._malloc(message.etf.byteLength);
        check(etfPtr !== 0);
    }
    let status;
    try {
        if (useHeap)
            module.HEAPU8.set(message.etf, etfPtr);
        status = module.ccall("sendVmMessage", "number", ["number", target.argType, "number", useHeap ? "number" : "array", "number"], [
            target.kind,
            target.value,
            target.length,
            useHeap ? etfPtr : message.etf,
            message.etf.byteLength,
        ]);
    }
    finally {
        if (useHeap)
            module._free(etfPtr);
    }
    if (status === 0) {
        return { ok: true, data: null };
    }
    if (status === 1) {
        const t = isNameTarget(message.target) ? message.target.name : "<pid>";
        return {
            ok: false,
            error: err("bridge:listener-not-found", { targetName: t }),
        };
    }
    if (status === 2) {
        return {
            ok: false,
            error: err("bridge:unserializable", {
                data: null,
                part: null,
                reason: "unsupported",
            }),
        };
    }
    unreachable();
}
function writeStdin(module, chunk) {
    check(module !== null);
    const status = module.ccall("popcornStdinEnqueue", "number", ["array", "number"], [chunk, chunk.byteLength]);
    check(status === 0);
}
function resizeTty(module, columns, rows) {
    check(module !== null);
    const status = module.ccall("popcornTtyResize", "number", ["number", "number"], [columns, rows]);
    check(status === 0);
}
const TARGET_REGISTERED_NAME = 0;
const TARGET_PID_BYTES = 1;
function isNameTarget(target) {
    return Object.hasOwn(target, "name");
}
function utf8Length(text) {
    return UTF8.encode(text).length;
}

let instance = null;
self.onmessage = (event) => {
    void dispatch(event).catch((error) => {
        console.error(error);
        toMain({
            type: "otp:error",
            payload: {
                kind: "error",
                data: error instanceof Error ? error.message : String(error),
            },
        });
    });
};
async function dispatch(event) {
    const data = readMainEvent(event.data);
    switch (data.type) {
        case "popcorn:boot": {
            check(instance === null);
            instance = start({
                otpAssetsRoot: data.payload.otpAssetsRoot ??
                    // The plugin generates this directory after Vite analyzes the worker.
                    new URL(/* @vite-ignore */ "./otp/", import.meta.url).href,
                emulatorArgs: data.payload.emulatorArgs,
                extraArgs: data.payload.extraArgs,
                env: data.payload.env,
                maxMemoryBytes: data.payload.maxMemoryBytes,
                ttySize: data.payload.ttySize,
                noshell: data.payload.noshell,
                createModule,
                emit: toMain,
            });
            void instance.vmReady.then(() => toMain({ type: "popcorn:boot-vm-ready", payload: {} }));
            const result = await instance.boot;
            if (!result.ok) {
                toMain({
                    type: "popcorn:boot-fail",
                    payload: result.error.serialize(),
                });
                return;
            }
            toMain({ type: "popcorn:boot-end", payload: {} });
            break;
        }
        case "popcorn:send": {
            check(instance !== null);
            const result = instance.send(data.payload.message);
            toMain({
                type: "popcorn:send-end",
                payload: {
                    id: data.payload.id,
                    result: result.ok
                        ? { ok: true, data: null }
                        : { ok: false, error: result.error.serialize() },
                },
            });
            break;
        }
        case "popcorn:bridge-reply": {
            // ignore the `send()` result, process could've died
            check(instance !== null);
            instance.send(data.payload.message);
            break;
        }
        case "popcorn:stdin": {
            check(instance !== null);
            instance.writeStdin(data.payload.chunk);
            break;
        }
        case "popcorn:tty-resize": {
            check(instance !== null);
            instance.resizeTty(data.payload.columns, data.payload.rows);
            break;
        }
        default:
            unreachable();
    }
}
