import { Popcorn } from '@swmansion/popcorn';
import { LiveSocketInstanceInterface } from 'phoenix_live_view';

interface LLVConfig {
    /**
     * URL of the directory with the Wasm runtime built by `mix llv.build`,
     * resolved against the URL of the script. Defaults to `"popcorn/"`.
     */
    assetsUrl?: string;
    /** Receives messages sent from the Wasm runtime with `Popcorn.JS.send/1` */
    eventHandler?: (event: unknown) => void;
}

type CallResult = {
    ok: true;
    data: unknown;
} | {
    ok: false;
    error: unknown;
};
declare class PopcornClient {
    private popcorn;
    get ready(): boolean;
    attach(popcorn: Popcorn): void;
    /**
     * Sends an action to the dispatcher and returns the dispatcher's reply.
     * Error replies are logged by default; pass suppressErrorLog to silence them.
     */
    call(message: {
        action: string;
        [key: string]: unknown;
    }, opts?: {
        suppressErrorLog?: boolean;
    }): Promise<CallResult>;
}
declare class LLVEngine {
    private socket;
    private config;
    private pop;
    private views;
    private mirrors;
    private bufferedServerEvents;
    private eventBusHooks;
    private popcornLink;
    private connectPromise;
    private constructor();
    /**
     * Creates an LLVEngine instance. Must be called before `livesocket.connect()`.
     * @param liveSocket - The phoenix_live_view LiveSocket instance.
     * @param config - Optional LLV configuration.
     */
    static create(liveSocket: LiveSocketInstanceInterface, config?: LLVConfig): LLVEngine;
    /**
     * Boots the WASM runtime and mounts every LocalLiveView on the page.
     * Typically called right after `liveSocket.connect()`. Idempotent —
     * repeated calls are no-ops.
     */
    connect(): void;
    private doConnect;
    private socketClass;
    private connectPopcornSocket;
    private mountView;
    private registerServerEventListener;
    private sendServerEvent;
    private registerHooks;
    private bindFormsIfHostless;
    private bootPopcorn;
    private handleEvent;
    private pushServerEvent;
    private scanAndMount;
    private flushBufferedServerEvents;
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
    pushEvent(viewId: string, event: string, payload?: Record<string, unknown>): Promise<void>;
}

export { LLVEngine, PopcornClient };
export type { LLVConfig };
