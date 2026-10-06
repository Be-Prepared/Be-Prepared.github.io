export interface ScanLoopOptions<R> {
    // Look at the current frame. May reject; scanning continues anyway.
    detect: () => Promise<R[]>;

    // Called with every non-empty result. Return true to stop scanning.
    onResult: (results: R[]) => boolean | void;

    // Minimum time between the start of one detection and the next. Keeps
    // battery use reasonable. Defaults to ~15 frames per second.
    intervalMs?: number;

    // Wait this long after a failed detection before trying again.
    errorDelayMs?: number;

    // For tests.
    now?: () => number;
    setTimeout?: (fn: () => void, ms: number) => any;
    clearTimeout?: (handle: any) => void;
}

// Repeatedly runs barcode detection.
//
// Guarantees that only one detection runs at a time, that start() while
// already running does not create a second loop, that stop() really stops
// (even when a detection is in flight), and that a failed detection does not
// end the loop. Any of those going wrong makes the scanner appear to "not
// reset" after reading a code.
export class ScanLoop<R> {
    private _generation = 0;
    private _options: Required<ScanLoopOptions<R>>;
    private _running = false;
    private _timer: any = null;

    constructor(options: ScanLoopOptions<R>) {
        this._options = {
            intervalMs: 66,
            errorDelayMs: 250,
            now: () => Date.now(),
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (handle) => clearTimeout(handle),
            ...options,
        };
    }

    get running() {
        return this._running;
    }

    start() {
        if (this._running) {
            return;
        }

        this._running = true;
        const generation = ++this._generation;
        this._schedule(generation, 0);
    }

    stop() {
        this._running = false;
        this._generation += 1;

        if (this._timer !== null) {
            this._options.clearTimeout(this._timer);
            this._timer = null;
        }
    }

    private _run(generation: number) {
        const started = this._options.now();
        let promise: Promise<R[]>;

        try {
            promise = Promise.resolve(this._options.detect());
        } catch (error) {
            promise = Promise.reject(error);
        }

        promise.then(
            (results) => {
                if (generation !== this._generation) {
                    return;
                }

                if (results && results.length && this._options.onResult(results)) {
                    this.stop();

                    return;
                }

                const elapsed = this._options.now() - started;
                this._schedule(
                    generation,
                    Math.max(0, this._options.intervalMs - elapsed)
                );
            },
            () => {
                if (generation === this._generation) {
                    this._schedule(generation, this._options.errorDelayMs);
                }
            }
        );
    }

    private _schedule(generation: number, ms: number) {
        this._timer = this._options.setTimeout(() => {
            this._timer = null;

            if (generation === this._generation) {
                this._run(generation);
            }
        }, ms);
    }
}
