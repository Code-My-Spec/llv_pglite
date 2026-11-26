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

function err$1(t, data) {
    return new PopcornError({ t, data });
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
function unwrap(result) {
    if (!result.ok)
        throw result.error;
    return result.data;
}

const VERSION = 0x83;
const NEW_FLOAT_EXT = 0x46;
const SMALL_INTEGER_EXT = 0x61;
const INTEGER_EXT = 0x62;
const SMALL_TUPLE_EXT = 0x68;
const LARGE_TUPLE_EXT = 0x69;
const NIL_EXT = 0x6a;
const LIST_EXT = 0x6c;
const BINARY_EXT = 0x6d;
const BINARY_HEADER_SIZE = 1 + 4;
const SMALL_BIG_EXT = 0x6e;
const LARGE_BIG_EXT = 0x6f;
const MAP_EXT = 0x74;
const ATOM_UTF8_EXT = 0x76;
const SMALL_ATOM_UTF8_EXT = 0x77;
const UTF8$1 = new TextEncoder();
class AtomTerm {
    name;
    constructor(name) {
        this.name = name;
    }
}
class TupleTerm {
    entries;
    constructor(entries) {
        this.entries = entries;
    }
}
/**
 * Creates a BEAM atom value.
 *
 * The atom must already exist in the receiving VM. Plain strings encode as binaries.
 */
function atom(name) {
    return new AtomTerm(name);
}
/**
 * Creates a BEAM tuple.
 *
 * Plain arrays encode as lists.
 */
function tuple(first, second, ...rest) {
    check(arguments.length > 1, "tuple requires at least two entries");
    return new TupleTerm([first, second, ...rest]);
}
/** Pre-encoded ETF sub-term bytes (no version prefix), spliced verbatim. */
class RawTerm {
    bytes;
    constructor(bytes) {
        this.bytes = bytes;
    }
    /**
     * Wraps a full external term (`term_to_binary` output) as a spliceable
     * sub-term by dropping its leading version byte.
     */
    static fromExternal(external) {
        if (external[0] !== VERSION) {
            throw new TypeError("expected a version-prefixed ETF external term");
        }
        return new RawTerm(external.subarray(1));
    }
}
function encode(data, mapper) {
    try {
        return { ok: true, data: new Encoder(mapper).encode(data) };
    }
    catch (error) {
        let reason = "unsupported";
        let part = data;
        if (error instanceof TypeError && isUnserializableReason(error.message)) {
            reason = error.message;
            part = error.cause;
        }
        return {
            ok: false,
            error: err$1("bridge:unserializable", { data, part, reason }),
        };
    }
}
class Encoder {
    mapper;
    ancestors = new Set();
    output = [];
    buffer = new ArrayBuffer(8);
    view = new DataView(this.buffer);
    constructor(mapper = (value) => value) {
        this.mapper = mapper;
    }
    encode(value) {
        this.byte(VERSION);
        this.value(value);
        return new Uint8Array(this.output);
    }
    value(value) {
        if (value === null || value === undefined) {
            this.atom("nil");
            return;
        }
        switch (typeof value) {
            case "boolean":
                this.atom(value ? "true" : "false");
                return;
            case "string":
                this.binary(value);
                return;
            case "number":
                this.number(value);
                return;
            case "bigint":
                this.integer(value);
                return;
            case "symbol": {
                const name = Symbol.keyFor(value) ?? value.description;
                if (name === undefined)
                    throw err("unsupported", value);
                this.atom(name);
                return;
            }
            case "object":
                this.object(value);
                return;
            default:
                throw err("unsupported", value);
        }
    }
    number(value) {
        if (!Number.isFinite(value)) {
            throw err("non-finite-float", value);
        }
        if (!Number.isInteger(value)) {
            this.byte(NEW_FLOAT_EXT);
            this.float64(value);
            return;
        }
        if (!Number.isSafeInteger(value)) {
            throw err("lossy-int", value);
        }
        this.integer(BigInt(value));
    }
    integer(value) {
        if (value >= 0n && value < 256n) {
            this.byte(SMALL_INTEGER_EXT);
            this.byte(Number(value));
            return;
        }
        if (value >= -2147483648n && value < 2147483648n) {
            this.byte(INTEGER_EXT);
            this.int32(Number(value));
            return;
        }
        let magnitude = value < 0n ? -value : value;
        const digits = [];
        while (magnitude > 0n) {
            digits.push(Number(magnitude & 0xffn));
            magnitude >>= 8n;
        }
        this.byte(digits.length < 256 ? SMALL_BIG_EXT : LARGE_BIG_EXT);
        if (digits.length < 256)
            this.byte(digits.length);
        else
            this.uint32(digits.length);
        this.byte(value < 0n ? 1 : 0);
        this.bytes(digits);
    }
    object(rawValue) {
        const value = this.mapper(rawValue);
        if (value instanceof RawTerm) {
            this.bytes(value.bytes);
            return;
        }
        if (value instanceof AtomTerm) {
            this.atom(value.name);
            return;
        }
        if (this.ancestors.has(value)) {
            throw err("cyclic-object", value);
        }
        this.ancestors.add(value);
        try {
            if (value instanceof TupleTerm) {
                this.tuple(value.entries);
                return;
            }
            if (Array.isArray(value)) {
                this.array(value);
                return;
            }
            if (value instanceof ArrayBuffer) {
                const bytes = new Uint8Array(value);
                this.binary(bytes);
                return;
            }
            if (ArrayBuffer.isView(value)) {
                const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                this.binary(bytes);
                return;
            }
            if (value instanceof Date) {
                this.date(value);
                return;
            }
            if (value instanceof Map) {
                this.entries(value.entries(), value);
                return;
            }
            if (value instanceof Set) {
                this.set(value);
                return;
            }
            const prototype = Object.getPrototypeOf(value);
            const isObject = prototype === Object.prototype || prototype === null;
            if (!isObject) {
                throw err("non-plain-object", value);
            }
            this.entries(Object.entries(value), value);
        }
        finally {
            this.ancestors.delete(value);
        }
    }
    tuple(entries) {
        if (entries.length < 2 ** 8) {
            this.byte(SMALL_TUPLE_EXT);
            this.byte(entries.length);
        }
        else {
            this.byte(LARGE_TUPLE_EXT);
            this.uint32(entries.length);
        }
        for (const entry of entries) {
            this.value(entry);
        }
    }
    array(value) {
        if (value.length === 0) {
            this.byte(NIL_EXT);
            return;
        }
        this.byte(LIST_EXT);
        this.uint32(value.length);
        for (const item of value) {
            this.value(item);
        }
        this.byte(NIL_EXT);
    }
    set(value) {
        // Elixir 1.20 uses the version-2 Erlang sets map representation.
        const members = [];
        for (const member of value)
            members.push([member, []]);
        const memberBytes = this.mapBytes(members, value, true);
        const map = new RawTerm(memberBytes);
        const fields = [
            [atom("__struct__"), atom("Elixir.MapSet")],
            [atom("map"), map],
        ];
        this.entries(fields, value);
    }
    date(value) {
        const year = value.getUTCFullYear();
        const validDate = Number.isFinite(value.getTime());
        const supportedYear = year >= -9999 && year <= 9999;
        if (!validDate || !supportedYear) {
            throw err("unsupported", value);
        }
        const fields = {
            __struct__: atom("Elixir.DateTime"),
            calendar: atom("Elixir.Calendar.ISO"),
            year,
            month: value.getUTCMonth() + 1,
            day: value.getUTCDate(),
            hour: value.getUTCHours(),
            minute: value.getUTCMinutes(),
            second: value.getUTCSeconds(),
            microsecond: tuple(value.getUTCMilliseconds() * 1000, 3),
            time_zone: "Etc/UTC",
            zone_abbr: "UTC",
            utc_offset: 0,
            std_offset: 0,
        };
        const entries = [];
        for (const [key, item] of Object.entries(fields)) {
            entries.push([atom(key), item]);
        }
        this.entries(entries, value);
    }
    termBytes(value) {
        const start = this.output.length;
        this.value(value);
        return this.output.splice(start);
    }
    mapBytes(entries, source, merge = false) {
        const encoded = [...entries].map(([key, value]) => ({
            key: this.termBytes(key),
            value: this.termBytes(value),
        }));
        encoded.sort((left, right) => compareKeys(left.key, right.key));
        const unique = [];
        for (const entry of encoded) {
            const previous = unique.at(-1);
            const duplicate = previous !== undefined && compareBytes(entry.key, previous.key) === 0;
            if (duplicate) {
                if (!merge)
                    throw err("unsupported", source);
                continue;
            }
            unique.push(entry);
        }
        const start = this.output.length;
        this.byte(MAP_EXT);
        this.uint32(unique.length);
        for (const entry of unique) {
            this.bytes(entry.key);
            this.bytes(entry.value);
        }
        return new Uint8Array(this.output.splice(start));
    }
    entries(entries, source) {
        this.bytes(this.mapBytes(entries, source));
    }
    atom(atom) {
        const bytes = UTF8$1.encode(atom);
        if ([...atom].length > 255) {
            throw err("unsupported", atom);
        }
        if (bytes.length < 2 ** 8) {
            this.byte(SMALL_ATOM_UTF8_EXT);
            this.byte(bytes.length);
        }
        else {
            this.byte(ATOM_UTF8_EXT);
            this.uint16(bytes.length);
        }
        this.bytes(bytes);
    }
    binary(value) {
        const bytes = typeof value === "string" ? UTF8$1.encode(value) : value;
        this.byte(BINARY_EXT);
        this.uint32(bytes.length);
        this.bytes(bytes);
    }
    byte(value) {
        this.output.push(value);
    }
    bytes(values) {
        for (let index = 0; index < values.length; index++) {
            this.output.push(values[index]);
        }
    }
    uint32(value) {
        this.view.setUint32(0, value);
        this.bytes(new Uint8Array(this.buffer, 0, 4));
    }
    uint16(value) {
        this.view.setUint16(0, value);
        this.bytes(new Uint8Array(this.buffer, 0, 2));
    }
    int32(value) {
        this.view.setInt32(0, value);
        this.bytes(new Uint8Array(this.buffer, 0, 4));
    }
    float64(value) {
        this.view.setFloat64(0, value);
        this.bytes(new Uint8Array(this.buffer));
    }
}
function err(reason, part) {
    return new TypeError(reason, { cause: part });
}
function compareBytes(a, b, start = 0) {
    const length = Math.min(a.length, b.length);
    for (let i = start; i < length; i++) {
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return a.length - b.length;
}
function compareKeys(left, right) {
    const leftTag = left[0];
    const rightTag = right[0];
    const binaryKeys = leftTag === BINARY_EXT && rightTag === BINARY_EXT;
    const offset = binaryKeys ? BINARY_HEADER_SIZE : 0;
    return compareBytes(left, right, offset);
}

function readWorkerEvent(value) {
    const data = objectWithKeys$1(value, ["type", "payload"]);
    check(data !== null && typeof data.type === "string");
    switch (data.type) {
        case "otp:stdout":
        case "otp:stderr":
        case "otp:error":
        case "otp:message":
        case "otp:run_js":
        case "otp:await-ready":
        case "otp:tracked-value-delete":
        case "popcorn:boot-vm-ready":
        case "popcorn:boot-end":
        case "popcorn:boot-fail":
        case "popcorn:send-end":
            return data;
        case "otp:stdin-consumed":
            check(Number(data.payload) > 0);
            return data;
        default:
            unreachable();
    }
}
function serializeSendPayload(target, payload, mapper) {
    if (isNameTarget(target)) {
        check(target.name.length > 0);
    }
    else {
        check(target.pid.byteLength > 0);
    }
    const etf = encode(payload, mapper);
    if (!etf.ok)
        return etf;
    return { ok: true, data: { target, etf: etf.data } };
}
function isNameTarget(target) {
    return Object.hasOwn(target, "name");
}
/** Usable only from main context. */
function toVm(worker, event, transfer) {
    worker.postMessage(event, transfer ?? []);
}

const TRACKED_REF_KEY = "popcorn_ref";
const PID_REF_KEY = "popcorn_pid";
const UTF8 = new TextEncoder();
const STDIN_QUEUE_CAPACITY_BYTES = 64 * 1024;
const DEFAULT_TTY_SIZE = { columns: 80, rows: 24 };
const DEFAULT_TIMEOUTS_MS = {
    boot: 10_000,
    appStartup: 60_000,
    send: 5_000,
};
const LOG_PREFIX = "[Popcorn]";
const DEFAULT_PROXY_NAME = "popcorn_proxy";
const DEFAULT_CALL_TIMEOUT_MS$1 = 5_000;
function createPidClass() {
    return class {
        bytes;
        constructor(bytes) {
            this.bytes = bytes;
        }
    };
}
function assertRunJsFn(value) {
    check(typeof value === "function");
}
/**
 * A BEAM VM in a browser worker.
 *
 * Use {@link Popcorn.init} to create and start an instance.
 **/
class Popcorn {
    /** Receives stdout. Can be replaced at any time; `undefined` restores the default output handler. */
    onStdout;
    /** Receives stderr. Can be replaced at any time; `undefined` restores the default output handler. */
    onStderr;
    vmWorker;
    state = { status: "created" };
    opts;
    maxMemoryBytes;
    ttySize;
    output;
    requestSeq = 0;
    settleBoot = null;
    eventHandlers = new Set();
    pendingSends = new Map();
    pendingCalls = new Map();
    readyWaiters = [];
    callSeq = 0;
    trackedValues = new Map();
    trackedKeySeq = 0;
    io = createIoState();
    vmReady = false;
    /** Calls a GenServer and returns its reply. See {@link tryCall} for a result instead of throwing. */
    async call(target, request, opts) {
        return unwrap(await this.tryCall(target, request, opts));
    }
    /** Sends a cast through the proxy. See {@link tryCast} for a result instead of throwing. */
    async cast(target, request, opts) {
        unwrap(await this.tryCast(target, request, opts));
    }
    TrackedValue = class {
        value;
        cleanup;
        constructor(value, cleanup) {
            this.value = value;
            this.cleanup = cleanup;
        }
    };
    Pid = createPidClass();
    onWorkerMessage = (event) => {
        const data = readWorkerEvent(event.data);
        switch (data.type) {
            case "popcorn:boot-vm-ready":
            case "popcorn:boot-end":
            case "popcorn:boot-fail":
                return;
            case "otp:message":
                this.emit(this.reviveHandles(data.payload));
                return;
            case "otp:run_js":
                this.vmReady = true;
                this.runJs(data.payload).catch((error) => {
                    check(error instanceof Error);
                    const payload = { ok: false, error: error.toString() };
                    this.sendRunJsReply(data.payload, payload);
                    throw error;
                });
                return;
            case "otp:await-ready":
                this.handleReadyRequest(data.payload.replyTo);
                return;
            case "otp:tracked-value-delete":
                this.deleteTrackedValue(data.payload);
                return;
            case "otp:stdout":
                this.handleStdout(data.payload);
                return;
            case "otp:stderr":
                this.handleStderr(data.payload);
                return;
            case "otp:stdin-consumed":
                check(data.payload > 0 && data.payload <= this.io.stdin.reservedBytes);
                this.io.stdin.reservedBytes -= data.payload;
                return;
            case "otp:error":
                this.handleOtpError(data.payload);
                return;
            case "popcorn:send-end": {
                this.completeSend(data.payload);
                return;
            }
            default:
                unreachable();
        }
    };
    /**
     * Creates the worker.
     *
     * Call {@link boot} to start the VM.
     **/
    constructor(opts = {}) {
        const ttySize = opts.tty?.size ?? DEFAULT_TTY_SIZE;
        check(isValidTtySize(ttySize));
        check(opts.beam?.otpAssetsRoot === undefined ||
            opts.beam.otpAssetsRoot.endsWith("/"), "otpAssetsRoot must end with a slash");
        const { maxMemory, ...beam } = opts.beam ?? {};
        this.maxMemoryBytes = resolveMaxMemory(maxMemory);
        this.opts = {
            ...opts,
            beam: {
                ...beam,
                emulatorArgs: beam.emulatorArgs ?? schedulers({ base: 1, dirtyCpu: 1, dirtyIo: 1 }),
            },
        };
        this.ttySize = { ...ttySize };
        this.onStdout = opts.onStdout;
        this.onStderr = opts.onStderr;
        this.output = resolveOutputHandlers(this.opts, this);
        if (opts.onEvent)
            this.onEvent(opts.onEvent);
        this.spawnWorker();
    }
    onWorkerError = (event) => {
        const payload = { kind: "error", data: event.message };
        try {
            (this.opts.onError ?? defaultOnError)(payload);
        }
        finally {
            this.deinit(exitReason(payload));
        }
    };
    spawnWorker() {
        this.vmWorker = this.opts.workerUrl
            ? new Worker(this.opts.workerUrl, { type: "module" })
            : // Keep this as one expression so Vite recognizes and bundles the worker.
                new Worker(new URL("./worker.mjs", import.meta.url), {
                    type: "module",
                });
        this.vmWorker.addEventListener("message", this.onWorkerMessage);
        this.vmWorker.addEventListener("error", this.onWorkerError);
    }
    /**
     * Creates an instance and waits for {@link boot}.
     *
     * Use `opts.onEvent` to receive messages sent during startup.
     *
     * @returns The instance. Rejects on failure.
     *
     * @see {@link PopcornOpts}
     */
    static async init(opts = {}) {
        if (!canEval()) {
            throw err$1("runtime:eval-unavailable", {});
        }
        const popcorn = new Popcorn(opts);
        return await popcorn.boot();
    }
    /**
     * Starts the VM and waits for its bridge and entrypoint application.
     *
     * Without an entrypoint, waits only for the bridge.
     *
     * After shutdown, starts a fresh VM with the original options.
     *
     * @returns This instance. Rejects on failure.
     *
     * @example
     * ```ts
     * const popcorn = new Popcorn({});
     * popcorn.onEvent((message) => console.log(message));
     * await popcorn.boot();
     * ```
     */
    async boot() {
        if (this.state.status === "booted")
            return this;
        check(this.state.status !== "booting", "Boot already in progress");
        const reboot = this.state.status === "closed";
        if (reboot) {
            this.spawnWorker();
        }
        this.Pid = createPidClass();
        this.io = createIoState();
        this.output = resolveOutputHandlers(this.opts, this);
        check(this.readyWaiters.length === 0);
        this.state = { status: "booting" };
        return await new Promise((resolve, reject) => {
            const timeoutsMs = { ...DEFAULT_TIMEOUTS_MS, ...this.opts.timeoutsMs };
            const settle = (result) => {
                if (this.settleBoot === null)
                    return;
                clearTimeout(timer);
                cleanup();
                if (!result.ok) {
                    this.deinit();
                }
                if (result.ok)
                    resolve(result.data);
                else
                    reject(result.error);
            };
            this.settleBoot = settle;
            const startPhase = (timeoutMs) => setTimeout(() => {
                const error = err$1("timeout", { operation: "init", timeoutMs });
                settle({ ok: false, error });
            }, timeoutMs);
            // The VM phase covers module instantiation and bridge readiness; the
            // app phase covers the entrypoint's application tree, which runs
            // arbitrary user startup code and can be much slower.
            let timer = startPhase(timeoutsMs.boot);
            const onBootMessage = (event) => {
                const data = readWorkerEvent(event.data);
                switch (data.type) {
                    case "popcorn:boot-vm-ready":
                        clearTimeout(timer);
                        timer = startPhase(timeoutsMs.appStartup);
                        break;
                    case "popcorn:boot-end":
                        this.state = { status: "booted" };
                        this.flushReadyWaiters();
                        settle({ ok: true, data: this });
                        break;
                    case "popcorn:boot-fail": {
                        const error = PopcornError.deserialize(data.payload);
                        settle({ ok: false, error });
                        break;
                    }
                }
            };
            const cleanup = () => {
                this.settleBoot = null;
                this.vmWorker.removeEventListener("message", onBootMessage);
            };
            this.vmWorker.addEventListener("message", onBootMessage);
            toVm(this.vmWorker, {
                type: "popcorn:boot",
                payload: {
                    ...this.opts.beam,
                    maxMemoryBytes: this.maxMemoryBytes,
                    ttySize: this.ttySize,
                    noshell: this.opts.tty === undefined,
                },
            });
        });
    }
    /**
     * Queues terminal input.
     *
     * Encodes strings as UTF-8 and copies byte arrays. Does not append a newline.
     *
     * Throws `stdio:overflow` if the chunk exceeds the remaining 64 KiB queue capacity.
     * An overflow leaves the queue unchanged.
     */
    writeStdin(chunk) {
        if (this.state.status === "closed")
            throw this.state.error;
        check(this.state.status === "booted");
        const bytes = toBytes(chunk);
        check(bytes.byteLength > 0);
        const attemptedBytes = this.io.stdin.reservedBytes + bytes.byteLength;
        if (attemptedBytes > STDIN_QUEUE_CAPACITY_BYTES) {
            const error = err$1("stdio:overflow", {
                capacityBytes: STDIN_QUEUE_CAPACITY_BYTES,
                attemptedBytes,
            });
            throw error;
        }
        this.io.stdin.reservedBytes = attemptedBytes;
        const event = { type: "popcorn:stdin", payload: { chunk: bytes } };
        toVm(this.vmWorker, event, [bytes.buffer]);
    }
    /**
     * Sends new terminal dimensions to a booted VM.
     *
     * Each dimension must be between 1 and 65,535.
     *
     * Throws on failure.
     */
    resizeTty(columns, rows) {
        if (this.state.status === "closed")
            throw this.state.error;
        check(this.state.status === "booted");
        check(isValidTtySize({ columns, rows }));
        toVm(this.vmWorker, {
            type: "popcorn:tty-resize",
            payload: { columns, rows },
        });
    }
    /**
     * Sends a payload to a registered process name or a {@link Pid} from this VM boot.
     *
     * The process receives `{wasm, Payload}`.
     * A send timeout does not cancel delivery.
     * Uses the value conversions in {@link AnyValue}. An omitted, `null`, or `undefined` payload becomes an empty map.
     *
     * @returns Rejects on failure.
     *
     * @example
     * Send an Erlang `{ok, <<"value">>}` tuple to a registered `receiver` process.
     *
     * ```ts
     * await popcorn.send("receiver", tuple(atom("ok"), "value"));
     * ```
     *
     * @see {@link AnyValue}
     * @see {@link atom}
     * @see {@link tuple}
     *
     * @see {@link trySend} for a result instead of throwing on expected failures.
     */
    async send(rawTarget, payload) {
        unwrap(await this.trySend(rawTarget, payload));
    }
    /** See {@link send}. */
    async trySend(rawTarget, payload) {
        if (this.state.status !== "booted") {
            if (this.state.status === "closed") {
                return { ok: false, error: this.state.error };
            }
            return { ok: false, error: err$1("bridge:not-started", {}) };
        }
        return await this.sendBridge(rawTarget, payload);
    }
    async sendBridge(rawTarget, payload) {
        let target;
        if (typeof rawTarget === "string" && rawTarget.length > 0) {
            target = { name: rawTarget };
        }
        else if (rawTarget instanceof this.Pid) {
            target = { pid: rawTarget.bytes };
        }
        else {
            return { ok: false, error: err$1("bridge:invalid-target", {}) };
        }
        const tracked = [];
        const command = serializeSendPayload(target, payload ?? {}, this.handleMapper(tracked));
        if (!command.ok) {
            return command;
        }
        for (const { key, value, cleanup } of tracked) {
            this.trackedValues.set(key, { value, cleanup });
        }
        const requestId = this.nextRequestId();
        const timeoutMs = { ...DEFAULT_TIMEOUTS_MS, ...this.opts.timeoutsMs }.send;
        return await new Promise((resolve) => {
            const timer = setTimeout(() => {
                const wasMessageStale = this.pendingSends.delete(requestId);
                if (wasMessageStale) {
                    resolve({
                        ok: false,
                        error: err$1("timeout", { operation: "send", timeoutMs }),
                    });
                }
            }, timeoutMs);
            this.pendingSends.set(requestId, (result) => {
                clearTimeout(timer);
                resolve(result);
            });
            toVm(this.vmWorker, {
                type: "popcorn:send",
                payload: { id: requestId, message: command.data },
            }, [command.data.etf.buffer]);
        });
    }
    /**
     * Registers a handler for BEAM message payloads.
     *
     * Messages with no handlers are lost. Startup messages can arrive before {@link boot} resolves.
     * VM errors and terminal output use the callbacks in {@link PopcornOpts}.
     *
     * @returns a function that removes the handler.
     */
    onEvent(handler) {
        this.eventHandlers.add(handler);
        return () => {
            this.eventHandlers.delete(handler);
        };
    }
    /**
     * Stops the worker and completes pending sends and calls with `vm:exited`.
     *
     * Releases tracked values and runs their cleanup callbacks.
     * Keeps event handlers for the next boot. Repeated calls have no effect.
     */
    deinit(reason = { reason: "deinit" }) {
        if (this.state.status === "closed") {
            return;
        }
        const error = err$1("vm:exited", reason);
        if (this.settleBoot !== null) {
            this.settleBoot({ ok: false, error });
            return;
        }
        this.state = { status: "closed", error };
        this.vmReady = false;
        this.readyWaiters.length = 0;
        for (const resolve of this.pendingSends.values()) {
            resolve({ ok: false, error });
        }
        this.pendingSends.clear();
        for (const pending of this.pendingCalls.values()) {
            pending.settle({ ok: false, error });
        }
        this.pendingCalls.clear();
        this.clearTrackedValues();
        this.vmWorker.removeEventListener("message", this.onWorkerMessage);
        this.vmWorker.removeEventListener("error", this.onWorkerError);
        this.vmWorker.terminate();
        // we keep onEvent() callbacks across reboots
    }
    clearTrackedValues() {
        for (const entry of this.trackedValues.values()) {
            try {
                entry.cleanup?.();
            }
            catch { }
        }
        this.trackedValues.clear();
    }
    emit(event) {
        const popcorn = objectWithKeys$1(event, ["_popcorn"])?._popcorn;
        const envelope = objectWithKeys$1(popcorn, ["t", "id", "payload"]);
        if (envelope !== null) {
            check(envelope.t === "proxy");
            this.completeCall(envelope.id, envelope.payload);
            return;
        }
        if (this.eventHandlers.size === 0) {
            console.warn(`${LOG_PREFIX} Dropped message with no event handlers`, event);
        }
        for (const handler of this.eventHandlers) {
            handler(event);
        }
    }
    completeCall(id, payload) {
        const pending = this.pendingCalls.get(id);
        const lateReply = pending === undefined;
        if (lateReply)
            return;
        this.pendingCalls.delete(id);
        pending.settle(this.parseCallReply(pending, payload));
    }
    parseCallReply(pending, payload) {
        const reply = payload;
        if (reply.ok)
            return { ok: true, data: reply.value };
        switch (reply.error.kind) {
            case "noproc": {
                const rawTarget = pending.target;
                const isName = typeof rawTarget === "string";
                const target = isName ? rawTarget : "<pid>";
                return {
                    ok: false,
                    error: err$1("genserver:noproc", { target }),
                };
            }
            case "exit":
                return {
                    ok: false,
                    error: err$1("genserver:exit", { reason: reply.error.reason }),
                };
            case "unserializable":
                return { ok: false, error: err$1("genserver:unserializable", {}) };
            case "timeout":
                return {
                    ok: false,
                    error: err$1("timeout", {
                        operation: "call",
                        timeoutMs: pending.timeoutMs,
                    }),
                };
            default:
                unreachable();
        }
    }
    /**
     * Calls a GenServer by registered name or {@link Pid} and waits for its reply.
     *
     * @param opts - `timeoutMs` defaults to 5 000 ms. `proxy` allows to select another registered proxy (see `Popcorn.Proxy`).
     * @returns A {@link Result} with the reply or a bridge, VM, timeout, or GenServer error.
     *
     * GenServer failures use `genserver:noproc`, `genserver:exit`, or `genserver:unserializable`.
     * A call timeout does not cancel server work.
     */
    async tryCall(rawTarget, request, opts) {
        if (this.state.status !== "booted") {
            if (this.state.status === "closed") {
                return { ok: false, error: this.state.error };
            }
            return { ok: false, error: err$1("bridge:not-started", {}) };
        }
        return await this.callBridge(rawTarget, request, opts);
    }
    async callBridge(rawTarget, request, opts) {
        const timeoutMs = opts?.timeoutMs ?? DEFAULT_CALL_TIMEOUT_MS$1;
        const proxy = opts?.proxy ?? DEFAULT_PROXY_NAME;
        const id = this.nextCallId();
        const result = new Promise((resolve) => {
            const timer = setTimeout(() => {
                const isUnresolved = this.pendingCalls.delete(id);
                if (isUnresolved) {
                    resolve({
                        ok: false,
                        error: err$1("timeout", { operation: "call", timeoutMs }),
                    });
                }
            }, timeoutMs);
            this.pendingCalls.set(id, {
                target: rawTarget,
                timeoutMs,
                settle: (settled) => {
                    clearTimeout(timer);
                    resolve(settled);
                },
            });
        });
        const sent = await this.sendBridge(proxy, {
            kind: "call",
            id,
            target: rawTarget,
            request: request,
            timeout_ms: timeoutMs,
        });
        if (!sent.ok) {
            const pending = this.pendingCalls.get(id);
            this.pendingCalls.delete(id);
            pending?.settle({ ok: false, error: sent.error });
        }
        return result;
    }
    /**
     * Sends a cast through the proxy.
     *
     * Success confirms delivery to the proxy
     * @see {@link tryCall}
     * @param opts - `proxy` allows to select another registered proxy.
     */
    async tryCast(rawTarget, request, opts) {
        if (this.state.status !== "booted") {
            if (this.state.status === "closed") {
                return { ok: false, error: this.state.error };
            }
            return { ok: false, error: err$1("bridge:not-started", {}) };
        }
        return await this.castBridge(rawTarget, request, opts);
    }
    async castBridge(rawTarget, request, opts) {
        const proxy = opts?.proxy ?? DEFAULT_PROXY_NAME;
        return await this.sendBridge(proxy, {
            kind: "cast",
            target: rawTarget,
            request: request,
        });
    }
    nextCallId() {
        this.callSeq += 1;
        return `call:${this.callSeq}`;
    }
    async runJs(request) {
        let payload;
        try {
            const fn = this.jsWithCurrentEnv(request.code);
            assertRunJsFn(fn);
            const args = this.reviveHandles(request.args);
            check(this.vmReady);
            const actions = {
                send: async (target, payload) => {
                    unwrap(await this.sendBridge(target, payload));
                },
                call: async (target, payload, opts) => unwrap(await this.callBridge(target, payload, opts)),
                cast: async (target, payload, opts) => {
                    unwrap(await this.castBridge(target, payload, opts));
                },
                trySend: (target, payload) => this.sendBridge(target, payload),
                tryCall: (target, payload, opts) => this.callBridge(target, payload, opts),
                tryCast: (target, payload, opts) => this.castBridge(target, payload, opts),
            };
            const result = await fn(args, actions);
            const value = request.return === "ref" ? this.asRef(result) : result;
            payload = { ok: true, value: value ?? null };
        }
        catch (error) {
            check(error instanceof Error, `JS.run/3 must throw an Error instance. Received: ${String(error)}`);
            payload = { ok: false, error: error.toString() };
        }
        this.sendRunJsReply(request, payload);
    }
    sendRunJsReply(request, payload) {
        const target = { pid: request.replyTo };
        const tracked = [];
        const command = serializeSendPayload(target, payload, this.handleMapper(tracked));
        if (command.ok) {
            for (const { key, value, cleanup } of tracked) {
                this.trackedValues.set(key, { value, cleanup });
            }
            this.sendBridgeReply(command.data);
            return;
        }
        const failure = serializeSendPayload(target, {
            ok: false,
            error: { unserializable: command.error.data.reason },
        });
        check(failure.ok);
        this.sendBridgeReply(failure.data);
    }
    handleReadyRequest(replyTo) {
        if (this.state.status === "booted") {
            this.sendReadyReply(replyTo);
            return;
        }
        check(this.state.status === "booting");
        this.readyWaiters.push(replyTo);
    }
    flushReadyWaiters() {
        for (const replyTo of this.readyWaiters)
            this.sendReadyReply(replyTo);
        this.readyWaiters.length = 0;
    }
    sendReadyReply(replyTo) {
        const message = serializeSendPayload({ pid: replyTo }, true);
        check(message.ok);
        this.sendBridgeReply(message.data);
    }
    asRef(value) {
        if (value instanceof this.TrackedValue)
            return value;
        return new this.TrackedValue(value);
    }
    sendBridgeReply(message) {
        toVm(this.vmWorker, { type: "popcorn:bridge-reply", payload: { message } }, [message.etf.buffer]);
    }
    jsWithCurrentEnv(code) {
        const make = new Function("TrackedValue", `"use strict"; return (${code});`);
        return make(this.TrackedValue);
    }
    reviveHandles(value) {
        const marker = objectWithKeys$1(value, ["popcorn_value"]);
        if (marker !== null && Object.keys(marker).length === 1) {
            return this.reviveValueTag(marker.popcorn_value);
        }
        const key = trackedRefKey(value);
        if (key !== null) {
            const entry = this.trackedValues.get(key);
            check(entry !== undefined);
            return entry.value;
        }
        const pidToken = pidRefToken(value);
        if (pidToken !== null) {
            return new this.Pid(base64ToBytes(pidToken));
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.reviveHandles(item));
        }
        const obj = objectWithKeys$1(value, []);
        if (obj !== null) {
            const entries = Object.entries(obj).map(([key, item]) => [
                key,
                this.reviveHandles(item),
            ]);
            return Object.fromEntries(entries);
        }
        return value;
    }
    reviveValueTag(payload) {
        check(Array.isArray(payload) && payload.length === 2);
        const [tag, data] = payload;
        switch (tag) {
            case "binary":
                check(typeof data === "string");
                return base64ToBytes(data);
            case "integer": {
                const integer = readInteger(data);
                const safe = integer >= BigInt(Number.MIN_SAFE_INTEGER) &&
                    integer <= BigInt(Number.MAX_SAFE_INTEGER);
                if (safe)
                    return Number(integer);
                return integer;
            }
            case "datetime": {
                const milliseconds = readInteger(data);
                const inRange = milliseconds >= -377705116800000n && milliseconds <= 253402300799999n;
                check(inRange);
                return new Date(Number(milliseconds));
            }
            case "set":
                check(Array.isArray(data));
                return new Set(data.map((item) => this.reviveHandles(item)));
            case "object": {
                check(Array.isArray(data));
                const entries = [];
                for (const entry of data) {
                    check(Array.isArray(entry) && entry.length === 2);
                    const [key, value] = entry;
                    check(typeof key === "string");
                    entries.push([key, this.reviveHandles(value)]);
                }
                const object = Object.fromEntries(entries);
                check(Object.keys(object).length === entries.length);
                return object;
            }
            default:
                check(false, "unknown popcorn value tag");
        }
    }
    /** Maps pids and `TrackedValue`s during encoding, collecting handles into
     * `tracked` for the caller to register once encoding succeeds. */
    handleMapper(tracked) {
        return (value) => {
            if (value instanceof this.Pid) {
                return RawTerm.fromExternal(value.bytes);
            }
            if (value instanceof this.TrackedValue) {
                const key = (this.trackedKeySeq += 1);
                tracked.push({ key, value: value.value, cleanup: value.cleanup });
                return { [TRACKED_REF_KEY]: key };
            }
            return value;
        };
    }
    deleteTrackedValue(key) {
        const entry = this.trackedValues.get(key);
        check(entry !== undefined);
        try {
            entry.cleanup?.();
        }
        finally {
            this.trackedValues.delete(key);
        }
    }
    completeSend(payload) {
        const resolve = this.pendingSends.get(payload.id) ?? null;
        const didTimeout = resolve === null;
        if (didTimeout)
            return;
        this.pendingSends.delete(payload.id);
        const result = payload.result;
        resolve(result.ok
            ? { ok: true, data: null }
            : { ok: false, error: PopcornError.deserialize(result.error) });
    }
    nextRequestId() {
        this.requestSeq += 1;
        return `send:${this.requestSeq}`;
    }
    handleStdout(chunk) {
        this.output.stdout(chunk);
    }
    handleStderr(chunk) {
        this.output.stderr(chunk);
    }
    handleOtpError(payload) {
        const onError = this.opts.onError ?? defaultOnError;
        onError(payload);
        check(this.state.status === "booting" || this.state.status === "booted");
        // if failed while booting, settle early
        const booting = this.state.status === "booting";
        if (booting) {
            check(this.settleBoot !== null);
            const error = err$1("vm:exited", exitReason(payload));
            this.settleBoot({ ok: false, error });
            return;
        }
        this.deinit(exitReason(payload));
    }
}
function resolveMaxMemory(limits) {
    const mobileLimit = parseMemorySize(limits?.mobile ?? "256M");
    const desktopLimit = parseMemorySize(limits?.desktop ?? "2G");
    const mobile = /Android|Mobile|iPad|iPhone|iPod/.test(navigator.userAgent);
    const ipad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    return mobile || ipad ? mobileLimit : desktopLimit;
}
function parseMemorySize(size) {
    const match = /^(\d+(?:\.\d+)?)([MG])$/.exec(size);
    check(match !== null, 'maxMemory must use M or G, such as "256M" or "2G"');
    const bytes = Number(match[1]) * (match[2] === "M" ? 1024 ** 2 : 1024 ** 3);
    check(Number.isSafeInteger(bytes) &&
        bytes >= 64 * 1024 * 1024 &&
        bytes <= 2 * 1024 * 1024 * 1024 &&
        bytes % 65536 === 0, "maxMemory must be a multiple of 64 KiB between 64 MiB and 2 GiB");
    return bytes;
}
/**
 * Builds `beam.emulatorArgs` for scheduler counts.
 *
 * Defaults to one scheduler of each type.
 */
function schedulers(opts) {
    const { base, dirtyCpu, dirtyIo } = opts;
    check(base > 0);
    check(dirtyCpu > 0);
    check(dirtyIo > 0);
    return ["-S", base, "-SDcpu", dirtyCpu, "-SDio", dirtyIo].map(String);
}
function isValidTtySize({ columns, rows }) {
    const colInRange = 0 < columns && columns <= 0xffff;
    const rowInRange = 0 < rows && rows <= 0xffff;
    return colInRange && rowInRange;
}
function resolveOutputHandlers(opts, callbacks) {
    if (opts.tty?.output === "bytes") {
        return {
            stdout: (chunk) => (callbacks.onStdout ??
                defaultOnStdoutBytes)(chunk),
            stderr: (chunk) => (callbacks.onStderr ??
                defaultOnStderrBytes)(chunk),
        };
    }
    const stdoutDecoder = new TextDecoder();
    const stderrDecoder = new TextDecoder();
    return {
        stdout: (chunk) => decodeOutput(stdoutDecoder, callbacks.onStdout ?? defaultOnStdout, chunk),
        stderr: (chunk) => decodeOutput(stderrDecoder, callbacks.onStderr ?? defaultOnStderr, chunk),
    };
}
function decodeOutput(decoder, onOutput, chunk) {
    const output = decoder.decode(chunk, { stream: true });
    if (output.length > 0)
        onOutput(output);
}
function createIoState() {
    return {
        stdin: {
            reservedBytes: 0,
        },
    };
}
function toBytes(chunk) {
    return typeof chunk === "string" ? UTF8.encode(chunk) : chunk.slice();
}
function exitReason(payload) {
    switch (payload.kind) {
        case "abort":
            return { reason: "abort", data: payload.data };
        case "error":
            return { reason: "error", data: payload.data };
        case "exit":
            return { reason: "exit", data: payload.data };
        default:
            return unreachable();
    }
}
function trackedRefKey(value) {
    const marker = objectWithKeys$1(value, [TRACKED_REF_KEY]);
    const hasOnlyMarker = marker !== null && Object.keys(marker).length === 1;
    if (!hasOnlyMarker) {
        return null;
    }
    const key = marker[TRACKED_REF_KEY];
    check(typeof key === "number");
    return key;
}
function pidRefToken(value) {
    const marker = objectWithKeys$1(value, [PID_REF_KEY]);
    const hasOnlyMarker = marker !== null && Object.keys(marker).length === 1;
    if (!hasOnlyMarker) {
        return null;
    }
    const token = marker[PID_REF_KEY];
    check(typeof token === "string");
    return token;
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#direct_and_indirect_eval
function indirectEval(code) {
    return (0, eval)(code);
}
function canEval() {
    try {
        indirectEval("0");
        return true;
    }
    catch {
        return false;
    }
}
function defaultOnStdout(chunk) {
    console.log(`${LOG_PREFIX} stdout:`, chunk);
}
function defaultOnStderr(chunk) {
    console.error(`${LOG_PREFIX} stderr:`, chunk);
}
function defaultOnStdoutBytes(chunk) {
    console.log(`${LOG_PREFIX} stdout:`, chunk);
}
function defaultOnStderrBytes(chunk) {
    console.error(`${LOG_PREFIX} stderr:`, chunk);
}
function defaultOnError(payload) {
    switch (payload.kind) {
        case "abort":
            console.error(`${LOG_PREFIX} abort:`, payload.data);
            return;
        case "error":
            console.error(`${LOG_PREFIX} error:`, payload.data);
            return;
        case "exit":
            console.info(`${LOG_PREFIX} exit:`, payload.data);
            return;
        default:
            unreachable();
    }
}
function readInteger(value) {
    check(typeof value === "string");
    check(/^-?(0|[1-9][0-9]*)$/.test(value));
    return BigInt(value);
}

const LV_TOPIC_PREFIX = "lv:";
const llvIdFromTopic = (topic) => topic.startsWith(LV_TOPIC_PREFIX) ? topic.slice(LV_TOPIC_PREFIX.length) : null;
// LiveView retries a join after this timeout, we don't want that
// thus we keep the timeout 'big enough'
const JOIN_TIMEOUT_MS = 120_000;
// A fake socket that connects LLV views to Popcorn.
// Phoenix channels can be normally constructed on top of this socket.
function createPopcornSocket(SocketClass, pop) {
    let transport = null;
    class PopcornTransport {
        readyState = 0; // CONNECTING
        onopen = () => { };
        onerror = () => { };
        onmessage = () => { };
        onclose = () => { };
        // The WebSocket-shaped signature the Socket constructs us with; the URL
        // is a dead label.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_endpointURL, _protocols) {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            transport = this;
            // The Socket assigns onopen/onmessage/onclose after `new`, so the
            // "connection" must open asynchronously.
            queueMicrotask(() => {
                this.readyState = 1; // OPEN
                this.onopen();
            });
        }
        // Deliver an inbound frame. Async so an ack never re-enters Socket code
        // in the middle of an outbound send.
        inject(frame) {
            queueMicrotask(() => {
                if (this.readyState === 1)
                    this.onmessage({ data: frame });
            });
        }
        send(frame) {
            // Ack heartbeats right away, as Wasm could
            // theoretically be late to ack and that would
            // kill all LLVs.
            if (frame.event == "heartbeat") {
                this.ack(frame, "ok", {});
                return;
            }
            const id = llvIdFromTopic(frame.topic);
            if (id === null) {
                this.ack(frame, "error", { reason: `unsupported channel ${frame.topic}` });
                return;
            }
            // JSON-encoded, as over a websocket, see LocalLiveView.Dispatcher.Serializer.
            // The event lets the dispatcher route the frame without decoding it.
            pop
                .call({ action: "transport_frame", id, event: frame.event, frame: JSON.stringify(frame) }, { suppressErrorLog: true })
                .then((result) => {
                if (!result.ok)
                    this.ack(frame, "error", result.error);
            });
        }
        // Ack an outbound frame in place (heartbeats, rejected frames).
        ack(frame, status, response) {
            this.inject({
                topic: frame.topic,
                event: "phx_reply",
                payload: { status, response },
                ref: frame.ref,
                join_ref: frame.join_ref,
            });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        close(_code, _reason) {
            this.readyState = 3; // CLOSED
            queueMicrotask(() => this.onclose({ code: 1000, wasClean: true }));
        }
    }
    // The endpoint URL is only a label — the transport never dereferences it.
    const socket = new SocketClass("/llv-popcorn", {
        transport: PopcornTransport,
        timeout: JOIN_TIMEOUT_MS,
        encode: (payload, callback) => callback(payload),
        decode: (rawPayload, callback) => callback(rawPayload),
    });
    socket.connect();
    return {
        socket,
        inject(frame) {
            transport?.inject(frame);
        },
    };
}

function llvIdOf(el) {
    return el.dataset.popId ?? el.id;
}
function resolveLlvId(viewOrId) {
    const el = Array.from(document.querySelectorAll("[data-pop-view]")).find((e) => e.getAttribute("data-pop-view") === viewOrId);
    return el ? llvIdOf(el) : viewOrId;
}

function registerNavigationHandlers(pop, socket, getAnyHook) {
    // Intercept clicks on patch links. Lets one `<.link patch>` work on any
    // page, no separate LLV link component needed.
    document.addEventListener("click", (e) => {
        const mainId = mainViewId();
        if (!mainId)
            return;
        const link = e.target.closest('a[data-phx-link="patch"]');
        if (!link)
            return;
        // For patch links, prevent the LV handlers from handling the event
        // as they would reload the page if there's no main LV on the server
        e.preventDefault();
        e.stopImmediatePropagation();
        const to = link.getAttribute("href") ?? window.location.href;
        writeHistory(to, link.getAttribute("data-phx-link-state") === "replace");
        handleParams(pop, mainId, to);
        // Preventing the event propagation breaks phx-click handling,
        // so it's triggered here manually.
        const phxClick = link.getAttribute("phx-click");
        if (phxClick)
            socket.execJS(link, phxClick, "click");
    });
    // Runs before Phoenix's popstate handler, because
    // it's registered first: LLVEngine.create must be called before
    // liveSocket.connect(), which registers Phoenix's.
    window.addEventListener("popstate", (e) => {
        const mainId = mainViewId();
        if (!mainId)
            return;
        // Prevent the LV handlers from handling the event,
        // as they would reload the page if there's no main LV on the server
        e.stopImmediatePropagation();
        handleParams(pop, mainId, window.location.href);
    });
    // llv:navigate: an LLV called push_patch
    window.addEventListener("llv:navigate", (e) => {
        const { href, replace } = e.detail;
        const mainId = mainViewId();
        if (mainId) {
            writeHistory(href, replace);
            handleParams(pop, mainId, href);
            return;
        }
        // Hooks only mount inside a LiveView, so there's none on a page without one
        const hook = getAnyHook();
        if (hook) {
            hook.js().patch(href, { replace });
        }
        else if (replace) {
            window.location.replace(href);
        }
        else {
            window.location.assign(href);
        }
    });
}
// The main LLV owns the page's navigation. Its mount point is in the
// server-rendered page from the start.
function mainViewId() {
    const el = document.querySelector("[data-pop-main]");
    return el ? llvIdOf(el) : null;
}
function writeHistory(href, replace) {
    if (replace) {
        window.history.replaceState(null, "", href);
    }
    else {
        window.history.pushState(null, "", href);
    }
}
// Runs handle_params in the main LLV. The dispatcher queues it if the view
// is still mounting.
function handleParams(pop, mainId, href) {
    pop.call({
        action: "dispatch_to_view",
        id: mainId,
        payload: { action: "handle_params", url: new URL(href, window.location.href).href },
    });
}

// Phoenix LiveView only binds click/keydown/keyup/blur/focus natively, so
// phx-mouse*/phx-window-mouse* and the HTML5 phx-drag* bindings are no-ops.
// Wire them up here, walking up from e.target to find the closest ancestor with
// the binding (same as how phx-click works) so element-level bindings on
// container elements also catch events from their descendants.
function registerCustomEventBindings(socket) {
    // The binding element's bounding rect is included so handlers can
    // position-aware-route the event (e.g. clientY - rect.top for the offset
    // within the element, rect.height for its size).
    const buildPointerData = (e, el) => {
        const rect = el.getBoundingClientRect();
        return {
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            screenX: e.screenX,
            screenY: e.screenY,
            movementX: e.movementX,
            movementY: e.movementY,
            button: e.button,
            buttons: e.buttons,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            },
        };
    };
    const isElement = (node) => node?.nodeType === Node.ELEMENT_NODE;
    // Walk up from `target` to the nearest element that carries the `binding`
    // attribute (e.g. "phx-dragover"), returning it or null if none is found.
    // Mirrors how phx-click resolves a handler from the event's deepest target.
    const closestWithBinding = (target, binding) => {
        let el = target;
        while (el && isElement(el) && !el.getAttribute(binding)) {
            el = el.parentNode;
        }
        return isElement(el) && el.getAttribute(binding) ? el : null;
    };
    const mouseEventTypes = ["mousedown", "mouseup", "mousemove", "mouseover", "mouseout"];
    for (const eventType of mouseEventTypes) {
        const elementBinding = `phx-${eventType}`;
        const windowBinding = `phx-window-${eventType}`;
        window.addEventListener(eventType, (e) => {
            const el = closestWithBinding(e.target, elementBinding);
            if (el) {
                const phxEvent = el.getAttribute(elementBinding);
                socket.debounce(el, e, eventType, () => {
                    socket.js().push(el, phxEvent, { value: buildPointerData(e, el) });
                });
            }
            else {
                document.querySelectorAll(`[${windowBinding}]`).forEach((wel) => {
                    const phxEvent = wel.getAttribute(windowBinding);
                    socket.debounce(wel, e, eventType, () => {
                        socket.js().push(wel, phxEvent, { value: buildPointerData(e, wel) });
                    });
                });
            }
        });
    }
    // HTML5 drag-and-drop. The browser only allows a drop — and shows the move
    // cursor — when dragenter/dragover call preventDefault() on a drop target,
    // and drop must preventDefault() too. dragstart seeds dataTransfer so Firefox
    // actually initiates the drag. Bindings are read off phx-drag* attributes and
    // dispatched just like the mouse events above, with the same pointer data so
    // handlers can use the rect to decide drop position.
    const dragEventTypes = [
        "dragstart",
        "dragenter",
        "dragover",
        "dragleave",
        "drop",
        "dragend",
    ];
    const dragPreventDefault = new Set(["dragenter", "dragover", "drop"]);
    for (const eventType of dragEventTypes) {
        const elementBinding = `phx-${eventType}`;
        window.addEventListener(eventType, (e) => {
            const el = closestWithBinding(e.target, elementBinding);
            if (!el)
                return;
            // preventDefault must run on every event (not just the throttled ones)
            // or the browser keeps rejecting the drop mid-drag.
            if (dragPreventDefault.has(eventType)) {
                e.preventDefault();
            }
            if (e.dataTransfer) {
                if (eventType === "dragstart") {
                    e.dataTransfer.effectAllowed = "move";
                    try {
                        e.dataTransfer.setData("text/plain", el.id || "");
                    }
                    catch {
                        // setData throws in some browsers outside a trusted dragstart context
                    }
                }
                else if (eventType === "dragover") {
                    e.dataTransfer.dropEffect = "move";
                }
            }
            const phxEvent = el.getAttribute(elementBinding);
            socket.debounce(el, e, eventType, () => {
                socket.js().push(el, phxEvent, { value: buildPointerData(e, el) });
            });
        });
    }
}

class Views {
    socket;
    pop;
    data = new Map();
    constructor(socket, pop) {
        this.socket = socket;
        this.pop = pop;
    }
    async mount(pop_view_el) {
        const llvId = llvIdOf(pop_view_el);
        if (this.data.has(llvId))
            return;
        const assigns = pop_view_el.getAttribute("data-pop-assigns");
        const data = { lastAssigns: assigns };
        this.data.set(llvId, data);
        const result = await this.pop.call({
            action: "create",
            id: llvId,
            view: pop_view_el.getAttribute("data-pop-view"),
            mirror_id: pop_view_el.dataset.popMirrorId ?? null,
            assigns,
            main: pop_view_el.hasAttribute("data-pop-main"),
            url: window.location.href,
        }, { suppressErrorLog: true });
        if (!result.ok) {
            console.error("LLV failed to create view", llvId, result.error);
            if (this.data.get(llvId) === data)
                this.data.delete(llvId);
            return;
        }
        // View unmounted while the create was in flight
        if (this.data.get(llvId) !== data)
            return;
        // HTML element removed while the create was in flight.
        // This covers host-less pages where there's no hook
        // that would handle the removal.
        if (!pop_view_el.isConnected) {
            this.data.delete(llvId);
            this.pop.call({ action: "destroy", id: llvId });
            return;
        }
        const { html } = result.data;
        const root = pop_view_el.querySelector("[data-pop-root]");
        if (!root) {
            console.error("LLV: mount point has no [data-pop-root] element", llvId);
            return;
        }
        this.adoptContainer(root, html);
        this.socket.newRootView(root).join();
    }
    unmount(pop_view_el) {
        const llvId = llvIdOf(pop_view_el);
        if (this.data.delete(llvId))
            this.pop.call({ action: "destroy", id: llvId });
    }
    // Replace the view's channel with the PopcornSocket channel
    // for the local views.
    // This relies on LV's private API and the fact that LV
    // opens the channel before it calls newRootView and joins it
    // afterwards.
    patchAdoption(popcornSocket) {
        const origNewRootView = this.socket.newRootView.bind(this.socket);
        this.socket.newRootView = (...args) => {
            const [el] = args;
            const view = origNewRootView(...args);
            if (el.matches?.("[data-pop-root]")) {
                const params = view.channel
                    .params;
                view.channel = popcornSocket.channel(`lv:${el.id}`, params);
            }
            return view;
        };
    }
    syncAssigns(pop_view_el) {
        const llvId = llvIdOf(pop_view_el);
        const data = this.data.get(llvId);
        if (!data)
            return;
        const assigns = pop_view_el.getAttribute("data-pop-assigns");
        if (assigns === null || assigns === data.lastAssigns)
            return;
        data.lastAssigns = assigns;
        this.pop.call({ action: "update_assigns", id: llvId, assigns });
    }
    // Copies LV session attributes from the WASM-rendered empty container
    // into a server-rendered container. Server-rendered container is kept
    // so that SSR is handled properly.
    adoptContainer(root, html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        const container = template.content.firstElementChild;
        for (const { name, value } of container.attributes) {
            root.setAttribute(name, value);
        }
        root.removeAttribute("inert");
    }
}

class Mirrors {
    socketClass;
    pop;
    channels = {};
    socket;
    constructor(socketClass, pop) {
        this.socketClass = socketClass;
        this.pop = pop;
    }
    sync(mirrorId, payload) {
        this.channels[mirrorId]?.push("sync", payload);
    }
    ensureChannel(pop_view_el) {
        const llvId = llvIdOf(pop_view_el);
        const mirrorId = pop_view_el.dataset.popMirrorId;
        const token = pop_view_el.dataset.popMirrorToken;
        if (!mirrorId || this.channels[mirrorId] || !token)
            return;
        const channel = this.connectedSocket().channel(`llv:${mirrorId}`, {
            view: pop_view_el.dataset.popView,
            token,
        });
        this.channels[mirrorId] = channel;
        let rejoin = false;
        channel
            .join()
            .receive("ok", () => {
            if (rejoin) {
                this.pop.call({
                    action: "dispatch_to_view",
                    id: llvId,
                    payload: { action: "mirror_reconnected" },
                });
            }
            rejoin = true;
        })
            .receive("error", (err) => console.error("LLV channel join error", err));
    }
    connectedSocket() {
        if (this.socket)
            return this.socket;
        const Socket = this.socketClass();
        const csrfToken = document.querySelector("meta[name='csrf-token']")?.getAttribute("content");
        this.socket = new Socket("/llv_socket", {
            params: { _csrf_token: csrfToken },
        });
        this.socket.connect();
        return this.socket;
    }
}

const DEFAULT_CALL_TIMEOUT_MS = 10_000;
const DISPATCHER_PROCESS_REF = "local_live_view_dispatcher";
class PopcornClient {
    popcorn = null;
    get ready() {
        return this.popcorn !== null;
    }
    attach(popcorn) {
        this.popcorn = popcorn;
    }
    /**
     * Sends an action to the dispatcher and returns the dispatcher's reply.
     * Error replies are logged by default; pass suppressErrorLog to silence them.
     */
    async call(message, opts) {
        let result;
        const { popcorn } = this;
        if (!popcorn) {
            result = { ok: false, error: new Error("LLV: popcorn call before runtime was ready") };
        }
        else {
            const reply = await popcorn.tryCall(DISPATCHER_PROCESS_REF, message, {
                timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
            });
            // The dispatcher replies with :ok, {:ok, data} or {:error, reason},
            // which arrive as "ok", ["ok", data] and ["error", reason].
            if (!reply.ok) {
                result = reply;
            }
            else if (reply.data == "ok") {
                result = { ok: true, data: null };
            }
            else if (Array.isArray(reply.data)) {
                const [replyStatus, data] = reply.data;
                result = replyStatus == "ok" ? { ok: true, data } : { ok: false, error: data };
            }
            else {
                throw new Error(`LLV: invalid dispatcher reply to ${message.action}: ${reply.data}`);
            }
        }
        if (!result.ok && !opts?.suppressErrorLog) {
            console.error(`LLV ${message.action} error`, result.error);
        }
        return result;
    }
}
class LLVEngine {
    socket;
    config;
    pop = new PopcornClient();
    views;
    mirrors;
    bufferedServerEvents = [];
    eventBusHooks = new Map();
    popcornLink;
    connectPromise = null;
    constructor(socket, config) {
        this.socket = socket;
        this.config = config;
        this.views = new Views(this.socket, this.pop);
        this.mirrors = new Mirrors(() => this.socketClass(), this.pop);
    }
    /**
     * Creates an LLVEngine instance. Must be called before `livesocket.connect()`.
     * @param liveSocket - The phoenix_live_view LiveSocket instance.
     * @param config - Optional LLV configuration.
     */
    static create(liveSocket, config = {}) {
        const engine = new LLVEngine(liveSocket, config);
        engine.registerServerEventListener();
        registerNavigationHandlers(engine.pop, engine.socket, () => engine.eventBusHooks.values().next().value);
        engine.registerHooks();
        engine.bindFormsIfHostless();
        engine.connectPopcornSocket();
        engine.views.patchAdoption(engine.popcornLink.socket);
        return engine;
    }
    /**
     * Boots the WASM runtime and mounts every LocalLiveView on the page.
     * Typically called right after `liveSocket.connect()`. Idempotent —
     * repeated calls are no-ops.
     */
    connect() {
        this.connectPromise ??= this.doConnect();
    }
    async doConnect() {
        try {
            await this.bootPopcorn();
            registerCustomEventBindings(this.socket);
            this.scanAndMount();
            this.flushBufferedServerEvents();
        }
        catch (err) {
            console.error("LLV: connect failed", err);
        }
    }
    // The app's Phoenix Socket class, recovered from the live instance the
    // LiveSocket already holds — same class, same version, same module as the
    // one LiveView runs on, with nothing to configure.
    socketClass() {
        return this.socket.getSocket().constructor;
    }
    connectPopcornSocket() {
        this.popcornLink = createPopcornSocket(this.socketClass(), this.pop);
    }
    async mountView(pop_view_el) {
        try {
            this.mirrors.ensureChannel(pop_view_el);
            await this.views.mount(pop_view_el);
        }
        catch (err) {
            console.error("LLV: failed to mount view", llvIdOf(pop_view_el), err);
        }
    }
    registerServerEventListener() {
        window.addEventListener("phx:llv_server_event", (e) => {
            const detail = e.detail;
            if (!this.pop.ready) {
                this.bufferedServerEvents.push(detail);
                return;
            }
            this.sendServerEvent(detail);
        });
    }
    sendServerEvent(detail) {
        this.pop.call({
            action: "dispatch_to_view",
            id: resolveLlvId(detail.view),
            payload: { action: "server_event", params: detail.payload },
        });
    }
    // Hooks that manage views rendered inside a host LiveView (other views are
    // mounted by the startup scan, which also catches hooks that fired before
    // Popcorn was ready) and the per-view event bus.
    registerHooks() {
        const pop = this.pop;
        const views = this.views;
        const mountView = (el) => this.mountView(el);
        this.socket.hooks.LocalLiveView = {
            mounted() {
                if (pop.ready)
                    mountView(this.el);
                // Sync assigns in case view was already mounted by the startup scan
                // (mountView is a noop) but the assigns changed.
                views.syncAssigns(this.el);
            },
            updated() {
                views.syncAssigns(this.el);
            },
            destroyed() {
                // The element is already detached; its subtree is still intact.
                views.unmount(this.el);
            },
        };
        // Hook for sending events from client to server via `LocalLiveView.push_server_event`
        // Sending an event via a hook freezes the element the hook binds to along with all
        // its descendants until the event is internally ACKed by LiveView, thus we use
        // a dedicated, empty div for that.
        const eventBusHooks = this.eventBusHooks;
        this.socket.hooks.LocalLiveViewEventBus = {
            mounted() {
                const llvId = this.el.getAttribute("data-llv-event-bus-for");
                if (llvId)
                    eventBusHooks.set(llvId, this);
            },
            destroyed() {
                const llvId = this.el.getAttribute("data-llv-event-bus-for");
                if (llvId && eventBusHooks.get(llvId) === this) {
                    eventBusHooks.delete(llvId);
                }
            },
        };
    }
    // Pages with only LocalLiveViews (no server-side LiveView) connect in "dead"
    // mode, which skips bindForms() — making phx-submit / phx-change no-ops on
    // any LLV. Wire them up manually when no real LiveView is on the page.
    bindFormsIfHostless() {
        if (!document.querySelector("[data-phx-session]:not([data-pop-root])")) {
            this.socket.bindForms();
        }
    }
    async bootPopcorn() {
        // The worker, and the Wasm runtime it loads, are where `mix llv.build`
        // puts them.
        const assetsUrl = new URL(this.config.assetsUrl ?? "popcorn/", import.meta.url);
        const popcorn = new Popcorn({ workerUrl: new URL("worker.mjs", assetsUrl) });
        popcorn.onEvent((event) => this.handleEvent(event));
        await popcorn.boot();
        this.pop.attach(popcorn);
    }
    // Events sent from the Wasm runtime by LocalLiveView.Dispatcher.send_to_js/2
    handleEvent(event) {
        const llvEvent = event;
        switch (llvEvent?.__llv__) {
            case "transport_push":
                this.popcornLink.inject(JSON.parse(llvEvent.frame));
                return;
            case "mirror_sync":
                this.mirrors.sync(llvEvent.mirror_id, JSON.parse(llvEvent.payload));
                return;
            case "push_server_event":
                this.pushServerEvent(llvEvent.id, llvEvent.event, JSON.parse(llvEvent.payload));
                return;
            case "navigate":
                window.dispatchEvent(new CustomEvent("llv:navigate", {
                    detail: { href: llvEvent.href, replace: llvEvent.replace },
                }));
                return;
            default:
                this.config.eventHandler?.(event);
        }
    }
    pushServerEvent(llvId, event, payload) {
        const pushError = () => this.pop.call({
            action: "dispatch_to_view",
            id: llvId,
            payload: { action: "push_error", event, params: payload },
        });
        const eventBus = this.eventBusHooks.get(llvId);
        if (!eventBus) {
            console.error("LLV push_server_event: no host event bus for view", llvId);
            pushError();
            return;
        }
        eventBus.pushEvent(event, payload).catch((err) => {
            console.error("LLV push_server_event failed", err);
            pushError();
        });
    }
    // Startup scan: mount every [data-pop-view] present now that Popcorn is up.
    // This is the mount path for host-less pages (no hooks fire there) and the
    // catch-up for hooks that fired before Popcorn was ready (Views.mount
    // dedupes on its registry).
    scanAndMount() {
        for (const el of document.querySelectorAll("[data-pop-view]")) {
            this.mountView(el);
        }
    }
    // Flush any server events that arrived during Popcorn initialization.
    flushBufferedServerEvents() {
        for (const detail of this.bufferedServerEvents) {
            this.sendServerEvent(detail);
        }
        this.bufferedServerEvents = [];
    }
    /**
     * Pushes an event into a local view from external JavaScript.
     *
     * Delivery is best-effort: the promise settles once the runtime accepts
     * the event (rejecting only on runtime failure), not when the view
     * processes it.
     *
     * @param viewId - The view name (e.g. `"ThermostatLive"`) or element id.
     * @param event - The event name dispatched to `handle_event/3`.
     * @param payload - Optional params map for the callback.
     */
    async pushEvent(viewId, event, payload = {}) {
        const result = await this.pop.call({
            action: "dispatch_to_view",
            id: resolveLlvId(viewId),
            payload: { action: "push_event", event, params: payload },
        }, { suppressErrorLog: true });
        if (!result.ok) {
            throw new Error(`LLV pushEvent: ${String(result.error)}`);
        }
    }
}

export { LLVEngine };
