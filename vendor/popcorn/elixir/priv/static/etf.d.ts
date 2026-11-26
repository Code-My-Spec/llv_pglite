import { type Result } from "./errors";
declare class AtomTerm {
    readonly name: string;
    constructor(name: string);
}
declare class TupleTerm {
    readonly entries: unknown[];
    constructor(entries: unknown[]);
}
/**
 * Creates a BEAM atom value.
 *
 * The atom must already exist in the receiving VM. Plain strings encode as binaries.
 */
export declare function atom(name: string): AtomTerm;
/** Alias for {@link atom}. */
export declare const a: typeof atom;
/**
 * Creates a BEAM tuple.
 *
 * Plain arrays encode as lists.
 */
export declare function tuple(first: unknown, second: unknown, ...rest: unknown[]): TupleTerm;
/** Alias for {@link tuple}. */
export declare const t: typeof tuple;
/** Pre-encoded ETF sub-term bytes (no version prefix), spliced verbatim. */
export declare class RawTerm {
    readonly bytes: Uint8Array;
    constructor(bytes: Uint8Array);
    /**
     * Wraps a full external term (`term_to_binary` output) as a spliceable
     * sub-term by dropping its leading version byte.
     */
    static fromExternal(external: Uint8Array): RawTerm;
}
export type Mapper = (value: object) => object;
export declare function encode(data: unknown, mapper?: Mapper): Result<Uint8Array<ArrayBuffer>, "bridge:unserializable">;
export {};
