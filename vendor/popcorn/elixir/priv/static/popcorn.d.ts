import { type Result } from "./errors";
import { type PopcornEvent } from "./events";
import type { AnyValue, BeamBootOptions, OtpErrorPayload, Pid, TtySize } from "./types";
type MemoryLimits = {
    mobile?: `${number}${"M" | "G"}`;
    desktop?: `${number}${"M" | "G"}`;
};
/** Output type for a terminal. */
type TtyOutput = "text" | "bytes";
type OutputChunk<Output extends TtyOutput> = Output extends "bytes" ? Uint8Array : string;
/** Browser VM configuration. */
export type PopcornOpts<Output extends TtyOutput = "text"> = {
    beam?: Pick<BeamBootOptions, "emulatorArgs" | "extraArgs" | "env"> & {
        /**
         * Maximum Wasm linear memory by platform. Omitted keys default to
         * mobile: "256M", desktop: "2G". M and G mean MiB and GiB.
         * Limits must be in 64 KiB increments between 64 MiB and 2 GiB.
         */
        maxMemory?: MemoryLimits;
        /**
         * Asset directory URL.
         *
         * Must end with `/`. Defaults to `otp/` next to the worker.
         */
        otpAssetsRoot?: string;
    };
    tty?: {
        /** Initial terminal size. Defaults to 80 columns and 24 rows. */
        size?: TtySize;
        /** Output callback format. Defaults to `text` with streamed UTF-8 decoding. Use `bytes` for raw chunks. */
        output?: Output;
    };
    timeoutsMs?: {
        /**
         * Maximum wait for the VM bridge.
         *
         * Defaults to 10 000 ms.
         */
        boot?: number;
        /**
         * Maximum wait for entrypoint startup after bridge readiness.
         *
         * Defaults to 60 000 ms.
         */
        appStartup?: number;
        /**
         * Maximum wait for a send resolving its process target.
         *
         * Defaults to 5 000 ms.
         */
        send?: number;
    };
    /**
     * Receives stdout.
     *
     * Defaults to `console.log`.
     * Receives `Uint8Array` when `tty.output` is "bytes", and `string` otherwise.
     */
    onStdout?: (chunk: OutputChunk<Output>) => void;
    /**
     * Receives stderr.
     *
     * Defaults to `console.error`.
     * Receives `Uint8Array` when `tty.output` is "bytes", and `string` otherwise.
     */
    onStderr?: (chunk: OutputChunk<Output>) => void;
    /**
     * Receives VM errors and exits before shutdown.
     *
     * Defaults to console output.
     */
    onError?: (event: OtpErrorPayload) => void;
    /** Receives BEAM message payloads, including messages sent during startup. */
    onEvent?: (event: PopcornEvent) => void;
    /**
     * Module worker URL.
     *
     * Defaults to the worker included with the package.
     */
    workerUrl?: string | URL;
};
type VmExitReason = {
    reason: "deinit";
} | {
    reason: "abort";
    data: string;
} | {
    reason: "error";
    data: string;
} | {
    reason: "exit";
    data: number;
};
type CallOpts = {
    timeoutMs?: number;
    proxy?: string;
};
export type GenServer = Pick<Popcorn, "call" | "cast" | "tryCall" | "tryCast">;
/**
 * A BEAM VM in a browser worker.
 *
 * Use {@link Popcorn.init} to create and start an instance.
 **/
export declare class Popcorn<Output extends TtyOutput = "text"> {
    /** Receives stdout. Can be replaced at any time; `undefined` restores the default output handler. */
    onStdout?: (chunk: OutputChunk<Output>) => void;
    /** Receives stderr. Can be replaced at any time; `undefined` restores the default output handler. */
    onStderr?: (chunk: OutputChunk<Output>) => void;
    private vmWorker;
    private state;
    private readonly opts;
    private readonly maxMemoryBytes;
    private readonly ttySize;
    private output;
    private requestSeq;
    private settleBoot;
    private readonly eventHandlers;
    private readonly pendingSends;
    private readonly pendingCalls;
    private readonly readyWaiters;
    private callSeq;
    private readonly trackedValues;
    private trackedKeySeq;
    private io;
    private vmReady;
    /** Calls a GenServer and returns its reply. See {@link tryCall} for a result instead of throwing. */
    call(target: string | Pid, request?: AnyValue, opts?: CallOpts): Promise<AnyValue>;
    /** Sends a cast through the proxy. See {@link tryCast} for a result instead of throwing. */
    cast(target: string | Pid, request?: AnyValue, opts?: {
        proxy?: string;
    }): Promise<void>;
    private readonly TrackedValue;
    private Pid;
    private readonly onWorkerMessage;
    /**
     * Creates the worker.
     *
     * Call {@link boot} to start the VM.
     **/
    constructor(opts?: PopcornOpts<Output>);
    private readonly onWorkerError;
    private spawnWorker;
    /**
     * Creates an instance and waits for {@link boot}.
     *
     * Use `opts.onEvent` to receive messages sent during startup.
     *
     * @returns The instance. Rejects on failure.
     *
     * @see {@link PopcornOpts}
     */
    static init<Output extends TtyOutput = "text">(opts?: PopcornOpts<Output>): Promise<Popcorn<Output>>;
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
    boot(): Promise<Popcorn<Output>>;
    /**
     * Queues terminal input.
     *
     * Encodes strings as UTF-8 and copies byte arrays. Does not append a newline.
     *
     * Throws `stdio:overflow` if the chunk exceeds the remaining 64 KiB queue capacity.
     * An overflow leaves the queue unchanged.
     */
    writeStdin(chunk: string | Uint8Array): void;
    /**
     * Sends new terminal dimensions to a booted VM.
     *
     * Each dimension must be between 1 and 65,535.
     *
     * Throws on failure.
     */
    resizeTty(columns: number, rows: number): void;
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
    send(rawTarget: string | Pid, payload?: AnyValue): Promise<void>;
    /** See {@link send}. */
    trySend(rawTarget: string | Pid, payload?: AnyValue): Promise<Result<null>>;
    private sendBridge;
    /**
     * Registers a handler for BEAM message payloads.
     *
     * Messages with no handlers are lost. Startup messages can arrive before {@link boot} resolves.
     * VM errors and terminal output use the callbacks in {@link PopcornOpts}.
     *
     * @returns a function that removes the handler.
     */
    onEvent(handler: (event: PopcornEvent) => void): () => void;
    /**
     * Stops the worker and completes pending sends and calls with `vm:exited`.
     *
     * Releases tracked values and runs their cleanup callbacks.
     * Keeps event handlers for the next boot. Repeated calls have no effect.
     */
    deinit(reason?: VmExitReason): void;
    private clearTrackedValues;
    private emit;
    private completeCall;
    private parseCallReply;
    /**
     * Calls a GenServer by registered name or {@link Pid} and waits for its reply.
     *
     * @param opts - `timeoutMs` defaults to 5 000 ms. `proxy` allows to select another registered proxy (see `Popcorn.Proxy`).
     * @returns A {@link Result} with the reply or a bridge, VM, timeout, or GenServer error.
     *
     * GenServer failures use `genserver:noproc`, `genserver:exit`, or `genserver:unserializable`.
     * A call timeout does not cancel server work.
     */
    tryCall(rawTarget: string | Pid, request?: AnyValue, opts?: CallOpts): Promise<Result<AnyValue>>;
    private callBridge;
    /**
     * Sends a cast through the proxy.
     *
     * Success confirms delivery to the proxy
     * @see {@link tryCall}
     * @param opts - `proxy` allows to select another registered proxy.
     */
    tryCast(rawTarget: string | Pid, request?: AnyValue, opts?: {
        proxy?: string;
    }): Promise<Result<null>>;
    private castBridge;
    private nextCallId;
    private runJs;
    private sendRunJsReply;
    private handleReadyRequest;
    private flushReadyWaiters;
    private sendReadyReply;
    private asRef;
    private sendBridgeReply;
    private jsWithCurrentEnv;
    private reviveHandles;
    private reviveValueTag;
    /** Maps pids and `TrackedValue`s during encoding, collecting handles into
     * `tracked` for the caller to register once encoding succeeds. */
    private handleMapper;
    private deleteTrackedValue;
    private completeSend;
    private nextRequestId;
    private handleStdout;
    private handleStderr;
    private handleOtpError;
}
/**
 * Thread counts for {@link schedulers}.
 *
 * Each count must be positive.
 */
export type SchedulerOptions = {
    /** Regular schedulers. */
    base: number;
    /** Dirty CPU schedulers. */
    dirtyCpu: number;
    /** Dirty I/O schedulers. */
    dirtyIo: number;
};
/**
 * Builds `beam.emulatorArgs` for scheduler counts.
 *
 * Defaults to one scheduler of each type.
 */
export declare function schedulers(opts: SchedulerOptions): string[];
export {};
