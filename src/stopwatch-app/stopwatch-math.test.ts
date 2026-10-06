import {
    currentLapMs,
    elapsed,
    formatStopwatch,
    initialStopwatch,
    isStopwatchState,
    isRunning,
    lap,
    lapRows,
    reset,
    start,
    stop,
} from './stopwatch-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('start, stop and resume use the wall clock', () => {
    let state = initialStopwatch();
    assert.equal(isRunning(state), false);
    assert.equal(elapsed(state, 5000), 0);
    state = start(state, 1000);
    assert.ok(isRunning(state));
    assert.equal(elapsed(state, 3500), 2500);
    // Starting twice doesn't restart.
    assert.equal(start(state, 3000), state);
    state = stop(state, 4000);
    assert.equal(isRunning(state), false);
    assert.equal(elapsed(state, 99999), 3000);
    assert.equal(stop(state, 5000), state);
    state = start(state, 10000);
    assert.equal(elapsed(state, 10250), 3250);
});

test('elapsed never goes backwards when the clock changes', () => {
    const state = start(
        { accumulatedMs: 500, laps: [], startedAt: null },
        10000
    );
    assert.equal(elapsed(state, 9000), 500);
});

test('laps', () => {
    let state = start(initialStopwatch(), 0);
    assert.equal(lap(initialStopwatch(), 100).laps.length, 0);
    state = lap(state, 1000);
    state = lap(state, 3000);
    state = stop(state, 3500);
    // Laps can't be added while stopped.
    assert.equal(lap(state, 4000), state);
    assert.deepEqual(state.laps, [1000, 3000]);
    assert.equal(currentLapMs(state, 99999), 500);
    state = start(state, 10000);
    assert.equal(currentLapMs(state, 10100), 600);
    state = lap(state, 10200);
    assert.deepEqual(state.laps, [1000, 3000, 3700]);
    assert.equal(currentLapMs(state, 10200), 0);
    // Lap totals are truncated to hundredths.
    state = lap(state, 10219);
    assert.equal(state.laps[3], 3710);
    assert.deepEqual(reset(), initialStopwatch());
});

test('lapRows', () => {
    assert.deepEqual(lapRows([]), []);
    assert.deepEqual(lapRows([1000]), [
        { className: 'lap', lapMs: 1000, number: 1, totalMs: 1000 },
    ]);
    assert.deepEqual(lapRows([1000, 3000, 3500, 5000]), [
        { className: 'lap', lapMs: 1500, number: 4, totalMs: 5000 },
        { className: 'lap fastest', lapMs: 500, number: 3, totalMs: 3500 },
        { className: 'lap slowest', lapMs: 2000, number: 2, totalMs: 3000 },
        { className: 'lap', lapMs: 1000, number: 1, totalMs: 1000 },
    ]);
    // Ties: the first one found is marked.
    assert.deepEqual(
        lapRows([1000, 2000, 4000]).map((row) => row.className),
        ['lap slowest', 'lap', 'lap fastest']
    );
    // All equal: nothing is marked.
    assert.deepEqual(
        lapRows([1000, 2000]).map((row) => row.className),
        ['lap', 'lap']
    );
});

test('formatStopwatch', () => {
    assert.equal(formatStopwatch(0), '00:00.00');
    assert.equal(formatStopwatch(-50), '00:00.00');
    assert.equal(formatStopwatch(9), '00:00.00');
    assert.equal(formatStopwatch(10), '00:00.01');
    assert.equal(formatStopwatch(999), '00:00.99');
    assert.equal(formatStopwatch(61234), '01:01.23');
    assert.equal(formatStopwatch(59 * 60000 + 59990), '59:59.99');
    assert.equal(formatStopwatch(3600000), '1:00:00.00');
    assert.equal(formatStopwatch(36 * 3600000 + 5 * 60000 + 7890), '36:05:07.89');
});

test('isStopwatchState', () => {
    assert.ok(isStopwatchState(initialStopwatch()));
    assert.ok(isStopwatchState({ accumulatedMs: 5, laps: [1, 2], startedAt: 9 }));
    assert.equal(isStopwatchState(null), false);
    assert.equal(isStopwatchState('x'), false);
    assert.equal(isStopwatchState({ accumulatedMs: -1, laps: [], startedAt: null }), false);
    assert.equal(
        isStopwatchState({ accumulatedMs: 0, laps: ['1'], startedAt: null }), false
    );
    assert.equal(isStopwatchState({ accumulatedMs: 0, laps: [], startedAt: 'now' }), false);
    assert.equal(isStopwatchState({ accumulatedMs: 0, startedAt: null }), false);
});
