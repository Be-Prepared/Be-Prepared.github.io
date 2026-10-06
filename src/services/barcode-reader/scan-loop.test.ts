import { ScanLoop } from './scan-loop';
import test from 'ava';

// A manual clock and timer queue so tests control exactly when things run.
class FakeTimers {
    now = 0;
    private _id = 0;
    private _queue = new Map<number, { at: number; fn: () => void }>();

    clearTimeout = (id: number) => {
        this._queue.delete(id);
    };

    setTimeout = (fn: () => void, ms: number) => {
        this._id += 1;
        this._queue.set(this._id, { at: this.now + ms, fn });

        return this._id;
    };

    get pending() {
        return this._queue.size;
    }

    // Run timers and let promise callbacks settle, repeatedly.
    async advance(ms: number) {
        const end = this.now + ms;

        while (true) {
            await flush();
            const next = [...this._queue.entries()]
                .filter(([, item]) => item.at <= end)
                .sort((a, b) => a[1].at - b[1].at)[0];

            if (!next) {
                break;
            }

            this._queue.delete(next[0]);
            this.now = Math.max(this.now, next[1].at);
            next[1].fn();
        }

        this.now = end;
        await flush();
    }
}

async function flush() {
    for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
    }
}

function setup(detect: () => Promise<string[]>, onResult = (_r: string[]) => true as boolean | void) {
    const timers = new FakeTimers();
    const results: string[][] = [];
    const loop = new ScanLoop<string>({
        detect,
        onResult: (r) => {
            results.push(r);

            return onResult(r);
        },
        intervalMs: 100,
        errorDelayMs: 500,
        now: () => timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
    });

    return { loop, results, timers };
}

test('scans until something is found, then stops', async (t) => {
    let calls = 0;
    const { loop, results, timers } = setup(() => {
        calls += 1;

        return Promise.resolve(calls === 3 ? ['code'] : []);
    });
    loop.start();
    await timers.advance(1000);
    t.is(calls, 3);
    t.deepEqual(results, [['code']]);
    t.false(loop.running);
    t.is(timers.pending, 0);
});

test('respects the interval', async (t) => {
    let calls = 0;
    const { loop, timers } = setup(() => {
        calls += 1;

        return Promise.resolve([]);
    });
    loop.start();
    await timers.advance(1000);
    // At 0, 100, ..., 1000
    t.is(calls, 11);
    loop.stop();
});

test('keeps going when onResult returns false', async (t) => {
    let calls = 0;
    const { loop, results, timers } = setup(
        () => {
            calls += 1;

            return Promise.resolve(['same']);
        },
        () => false
    );
    loop.start();
    await timers.advance(250);
    t.is(results.length, 3);
    t.true(loop.running);
    loop.stop();
});

test('a failed detection does not end the loop', async (t) => {
    let calls = 0;
    const { loop, results, timers } = setup(() => {
        calls += 1;

        if (calls < 3) {
            return Promise.reject(new Error('InvalidStateError'));
        }

        return Promise.resolve(['code']);
    });
    loop.start();
    await timers.advance(2000);
    t.is(calls, 3);
    t.deepEqual(results, [['code']]);
});

test('a detector that throws synchronously does not end the loop', async (t) => {
    let calls = 0;
    const { loop, results, timers } = setup(() => {
        calls += 1;

        if (calls === 1) {
            throw new Error('boom');
        }

        return Promise.resolve(['code']);
    });
    loop.start();
    await timers.advance(2000);
    t.deepEqual(results, [['code']]);
});

test('start while running does not create a second loop', async (t) => {
    let calls = 0;
    const { loop, timers } = setup(() => {
        calls += 1;

        return Promise.resolve([]);
    });
    loop.start();
    loop.start();
    loop.start();
    await timers.advance(1000);
    t.is(calls, 11);
    loop.stop();
});

test('stop during an in-flight detection discards its result', async (t) => {
    let resolveDetect: (value: string[]) => void = () => {};
    const { loop, results, timers } = setup(
        () => new Promise((resolve) => (resolveDetect = resolve))
    );
    loop.start();
    await timers.advance(0);
    loop.stop();
    resolveDetect(['late']);
    await timers.advance(1000);
    t.deepEqual(results, []);
    t.is(timers.pending, 0);
});

test('restart after finding a code scans again', async (t) => {
    let calls = 0;
    const { loop, results, timers } = setup(() => {
        calls += 1;

        return Promise.resolve([`code${calls}`]);
    });
    loop.start();
    await timers.advance(1000);
    t.deepEqual(results, [['code1']]);
    loop.start();
    await timers.advance(1000);
    t.deepEqual(results, [['code1'], ['code2']]);
});

test('stop then quick start does not leave two loops', async (t) => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { loop, timers } = setup(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        return new Promise((resolve) =>
            timers.setTimeout(() => {
                inFlight -= 1;
                resolve([]);
            }, 50)
        );
    });
    loop.start();
    await timers.advance(10);
    loop.stop();
    loop.start();
    await timers.advance(1000);
    // The stale detection may still be finishing when the new one starts,
    // but it must not schedule more work.
    t.true(maxInFlight <= 2);
    loop.stop();
    await timers.advance(1000);
    t.is(timers.pending, 0);
});
