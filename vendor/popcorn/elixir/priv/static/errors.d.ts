/**
 * An operation result. Check `ok` before accessing `data` or `error`.
 * Expected failures from `try*` methods use the error branch. Invalid usage can still throw.
 */
export type Result<T, E extends Tag = Tag> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: PopcornError<E>;
};
type Tag = keyof PopcornErrors;
/** Error tags and their structured details. Match tags instead of message text. */
export type PopcornErrors = {
    timeout: {
        operation: "init" | "send" | "call";
        timeoutMs: number;
    };
    "worker:load": {
        message: string;
    };
    "vm:exited": VmExitedData;
    "bridge:not-started": EmptyData;
    "bridge:invalid-target": EmptyData;
    "bridge:unserializable": UnserializableData;
    "bridge:listener-not-found": {
        targetName: string;
    };
    "genserver:noproc": {
        target: string;
    };
    "genserver:exit": {
        reason: string;
    };
    "genserver:unserializable": EmptyData;
    "stdio:overflow": {
        capacityBytes: number;
        attemptedBytes: number;
    };
    "asset:load": {
        kind: "manifest" | "tarball";
        url: string;
    } | {
        kind: "manifest-entry";
        url: string;
        name: string;
        available: string[];
    };
    "runtime:eval-unavailable": EmptyData;
};
/** Error tag and details without the Error instance or stack. */
export type SerializedError<T extends Tag = Tag> = {
    [K in T]: {
        t: K;
        data: PopcornErrors[K];
    };
}[T];
type EmptyData = Record<never, never>;
export type UnserializableReason = "cyclic-object" | "non-plain-object" | "lossy-int" | "non-finite-float" | "unsupported";
type UnserializableData = {
    data: unknown;
    part: unknown;
    reason: UnserializableReason;
};
type VmExitedData = {
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
export declare function err<T extends Tag>(t: T, data: PopcornErrors[T]): PopcornError<T>;
export declare function isErr<T extends Tag = Tag>(error: unknown, t?: T): error is PopcornError<T>;
/** @hidden */
export declare class PopcornError<T extends Tag = Tag> extends Error {
    readonly cause: SerializedError<T>;
    private readonly serialized;
    constructor(cause: SerializedError<T>);
    get t(): T;
    get data(): PopcornErrors[T];
    /** Returns the tag and a shallow copy of its details. */
    serialize(): SerializedError<T>;
    /** Restores a serialized error. Throws if validation fails. */
    static deserialize(value: unknown): PopcornError;
}
export declare function isUnserializableReason(value: unknown): value is UnserializableReason;
export declare function unwrap<T>(result: Result<T>): T;
export {};
